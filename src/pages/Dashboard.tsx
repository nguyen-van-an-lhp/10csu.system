import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Layout } from '../components/Layout';
import { MagicCard, Modal, Loader } from '../components/ui';
import { fileToBase64 } from '../lib/file';
import { compressImage } from '../lib/image';
import { exportTkbToWord } from '../lib/tkbExport';
import { cn } from '../lib/utils';
import {
  Calendar as CalendarIcon, Clock, AlertCircle, AlertTriangle, BookOpen, Users, CheckCircle2, XCircle, Plus, Edit3, Trash2,
  Paperclip, ChevronDown, ChevronUp, Search, FileText, X, NotebookPen, LayoutDashboard, Bookmark, Download
} from 'lucide-react';
import type { Post, Attachment, TimelineEvent, TimelineType, TimelineStatus, BoardNotes, BoardTkb, TkbMeta, TeacherNote } from '../types';

// ============================================================================
// TRANG TỔNG QUAN HỢP NHẤT (v13.0) — gộp 3 trang cũ (Tổng quan / Thông báo /
// Lịch trình) thành 1 màn hình, theo yêu cầu giảm tải điều hướng. Thứ tự xếp:
// 1) Lịch trình (thời gian-nhạy cảm, cần thấy ngay) → 2) Thông báo → 3) Sĩ số
// lớp (tham khảo tĩnh, ít khẩn cấp nhất). Toàn bộ nghiệp vụ CRUD của 2 trang
// cũ được giữ nguyên 100%, chỉ đổi chỗ hiển thị — không cắt tính năng.
// ============================================================================

// ---------------------------------------------------------------------------
// PHẦN 1: LỊCH TRÌNH & SỰ KIỆN
// ---------------------------------------------------------------------------
function TimelineSection() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TimelineType>('deadline');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const events = appState?.timeline || [];
  // Sửa lỗi phân quyền: Lớp phó Văn nghệ (vannghe) phụ trách hạng mục "Phong
  // Trào" ở backend (ROLE_REPORT_SCOPE), tức bao gồm sự kiện ngoại khóa — nên
  // họ phải được tạo/sửa Timeline giống các ban cán sự khác. Trước đây thiếu.
  const canManage = session?.role === 'gvcn' || ['loptruong', 'hoctap', 'kyluat', 'bithu', 'vannghe'].includes(session?.role || '');

  // Việc đã đánh dấu HOÀN THÀNH giờ tự ẩn khỏi danh sách chính thay vì hiển
  // thị mờ xen giữa — timeline chỉ còn việc đang chờ (pending) và đã hủy
  // (cancelled, vẫn hiện để biết lý do không làm). Việc hoàn thành vẫn tồn
  // tại trong dữ liệu (không xóa thật), chỉ không hiện ở đây nữa — đúng yêu
  // cầu "đã hoàn thành thì bị xóa" khỏi tầm nhìn.
  const visibleEvents = events.filter(e => e.status !== 'completed');

  const sortedEvents = [...visibleEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const groupedEvents = sortedEvents.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
  // Sửa bug: Object.entries() không đảm bảo tuyệt đối giữ đúng thứ tự chèn
  // cho MỌI trường hợp khóa chuỗi — trước đây duyệt thẳng entries() khiến
  // các ngày đôi khi hiển thị lộn xộn (vd 28/07 hiện sau 26/10). Sort lại
  // tường minh theo ngày ngay trước khi render, không phụ thuộc thứ tự
  // ngầm định của object.
  const groupedEntries = Object.entries(groupedEvents).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  const todayIso = new Date().toISOString().slice(0, 10);
  const isUrgent = (dateStr: string) => {
    const diffDays = Math.ceil((new Date(dateStr).getTime() - new Date(todayIso).getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 2; // hôm nay, ngày mai, ngày kia
  };

  // Vá lỗi hiển thị: nếu ô "Khung giờ" trong Google Sheet bị định dạng tự
  // động thành "Time" (thay vì "Plain text"), Sheets diễn giải chuỗi người
  // dùng gõ (vd "19:00") thành time-value nội bộ — khi backend đọc lại qua
  // getValues(), giá trị trả về có thể là timestamp ISO, hoặc (đã xác nhận
  // qua lỗi runtime thật "raw.match is not a function") thậm chí một kiểu
  // KHÁC hẳn string — Date object hoặc number serial-date của Sheets — dù
  // type khai báo ở TypeScript là string. Type khai báo chỉ là lời hứa lúc
  // biên dịch, không đảm bảo runtime thật khi dữ liệu đến từ Apps Script
  // (không được TypeScript kiểm soát). Ép kiểu về string AN TOÀN trước khi
  // xử lý, chấp nhận mọi kiểu giá trị có thể nhận được mà không crash.
  const formatTimeSlot = (raw: unknown): string => {
    if (raw === null || raw === undefined || raw === '') return '';
    const str = raw instanceof Date ? raw.toISOString() : String(raw);
    const m = str.match(/^1899-12-30T(\d{2}):(\d{2}):\d{2}/);
    if (m) return `${m[1]}:${m[2]}`;
    return str;
  };

  const resetForm = () => { setEditingId(null); setType('deadline'); setDate(''); setTimeSlot(''); setTitle(''); setDescription(''); };
  const handleOpenCreate = () => { resetForm(); setIsModalOpen(true); };
  const handleOpenEdit = (e: TimelineEvent) => {
    setEditingId(e.id); setType(e.type); setDate(e.date); setTimeSlot(formatTimeSlot(e.timeSlot)); setTitle(e.title); setDescription(e.description);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      if (editingId) { await api.call('TIMELINE_EDIT', { id: editingId, type, date, timeSlot, title, description }); showToast('Đã cập nhật sự kiện!', 'success'); }
      else { await api.call('TIMELINE_CREATE', { type, date, timeSlot, title, description }); showToast('Đã thêm sự kiện mới!', 'success'); }
      await refreshData(); setIsModalOpen(false); resetForm();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sự kiện này khỏi lịch trình?')) return;
    setIsProcessing(true);
    try { await api.call('TIMELINE_DELETE', { id }); await refreshData(); showToast('Đã xóa sự kiện.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleStatusChange = async (id: string, newStatus: TimelineStatus) => {
    setIsProcessing(true);
    try { await api.call('TIMELINE_STATUS', { id, status: newStatus }); await refreshData(); showToast('Cập nhật trạng thái thành công.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const getTypeConfig = (t: TimelineType) => {
    switch (t) {
      case 'exam': return { icon: BookOpen, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Lịch thi/Kiểm tra' };
      case 'deadline': return { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Hạn chót (Deadline)' };
      case 'meeting': return { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Họp/Sinh hoạt' };
      case 'event': return { icon: CalendarIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Sự kiện ngoại khóa' };
      default: return { icon: CalendarIcon, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: 'Khác' };
    }
  };

  const formatDateDisplay = (dateString: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateString));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-sans font-bold text-gray-900 flex items-center gap-2"><CalendarIcon size={18} className="text-primary-700" /> Lịch trình</h2>
        {canManage && (
          <button onClick={handleOpenCreate} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-700 text-white text-xs font-bold rounded-xl hover:bg-primary-700 transition">
            <Plus size={14} /> Thêm sự kiện
          </button>
        )}
      </div>

      {/* Nền mint nhạt (emerald-50 → teal-50) thay cho trắng phẳng — tạo
          điểm nhấn thị giác riêng cho khối Lịch trình, đồng thời làm nổi
          bật card sự kiện trắng bên trong (tương phản rõ ràng hơn hẳn so
          với card trắng trên nền trắng trước đây). */}
      <div className="bg-gradient-to-br from-primary-50 to-sky-50 rounded-3xl border border-primary-100 shadow-sm overflow-hidden">
        {groupedEntries.length === 0 ? (
          <div className="text-center py-14 px-6">
            <CalendarIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium text-sm">Chưa có kế hoạch nào sắp tới.</p>
          </div>
        ) : (
          // Timeline dạng TRỤC: một đường dọc liền mạch chạy xuyên suốt các
          // mốc ngày (trước đây mỗi ngày là khối rời rạc, không có đường nối
          // nào thể hiện tính liên tục theo thời gian — không giống timeline
          // thật). Đường trục đặt ở mép trái, mỗi mốc ngày có 1 chấm tròn
          // đục lỗ ngồi đúng trên đường trục.
          <div className="p-4 md:p-5">
            <div className="relative pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-primary-200" />
              <div className="space-y-6">
                {groupedEntries.map(([d, dateEvents]) => (
                  <div key={d} className="relative">
                    <div className={cn(
                      'absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 bg-white',
                      isUrgent(d) ? 'border-primary-600' : 'border-primary-300'
                    )} />
                    <div className="flex items-center gap-2 mb-2.5">
                      <h3 className="text-sm font-bold text-primary-700 capitalize">{formatDateDisplay(d)}</h3>
                      {isUrgent(d) && <span className="chip bg-primary-50 text-primary-700 border-primary-200 text-[9px] py-0">Sắp tới</span>}
                    </div>
                    {/* Lưới nhiều cột trên màn rộng — tận dụng chiều ngang thay vì
                        xếp mãi theo chiều dọc như bản cũ. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {dateEvents.map(evt => {
                        const cfg = getTypeConfig(evt.type);
                        const Icon = cfg.icon;
                        const isCancelled = evt.status === 'cancelled';
                        return (
                          <div key={evt.id} className={cn('p-3.5 rounded-xl border transition hover:shadow-md group', isCancelled ? 'bg-primary-50/50 border-primary-100 opacity-50' : `bg-white ${cfg.border} shadow-sm`)}>
                            <div className="flex items-start gap-2.5">
                              <div className={cn('p-2 rounded-lg flex-shrink-0', isCancelled ? 'bg-gray-200 text-gray-500' : cfg.bg + ' ' + cfg.color)}><Icon size={18} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase', isCancelled ? 'bg-gray-200 text-gray-600' : cfg.bg + ' ' + cfg.color)}>{cfg.label}</span>
                                  {evt.timeSlot && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"><Clock size={10} /> {formatTimeSlot(evt.timeSlot)}</span>}
                                </div>
                                <h4 className={cn('text-sm font-bold leading-snug', isCancelled ? 'text-gray-500 line-through' : 'text-gray-900')}>{evt.title}</h4>
                                {evt.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{evt.description}</p>}
                              </div>
                            </div>
                            {canManage && (
                              <div className="flex items-center justify-end gap-0.5 mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition">
                                {evt.status !== 'completed' && <button onClick={() => handleStatusChange(evt.id, 'completed')} disabled={isProcessing} className="p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition" title="Đánh dấu hoàn thành"><CheckCircle2 size={14} /></button>}
                                {evt.status !== 'cancelled' && <button onClick={() => handleStatusChange(evt.id, 'cancelled')} disabled={isProcessing} className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition" title="Hủy sự kiện"><XCircle size={14} /></button>}
                                {evt.status !== 'pending' && <button onClick={() => handleStatusChange(evt.id, 'pending')} disabled={isProcessing} className="p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition" title="Khôi phục trạng thái"><Clock size={14} /></button>}
                                <button onClick={() => handleOpenEdit(evt)} className="p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition" title="Chỉnh sửa"><Edit3 size={14} /></button>
                                <button onClick={() => handleDelete(evt.id)} disabled={isProcessing} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Xóa bỏ"><Trash2 size={14} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Cập nhật Lịch trình' : 'Thêm Sự kiện mới'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-700">Phân loại</label>
              <select value={type} onChange={e => setType(e.target.value as TimelineType)} className="field bg-gray-50">
                <option value="exam">Kiểm tra / Thi</option>
                <option value="deadline">Hạn chót (Deadline)</option>
                <option value="meeting">Họp / Sinh hoạt</option>
                <option value="event">Sự kiện ngoại khóa</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-700">Ngày diễn ra</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="field bg-gray-50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700">Khung giờ (Tùy chọn)</label>
            <input type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder="VD: Tiết 3 - 4, hoặc 19:00" className="field bg-gray-50" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700">Tiêu đề Sự kiện / Công việc</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Nộp báo cáo chuyên đề Lịch sử" className="field bg-gray-50" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700">Ghi chú chi tiết</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ghi chú thêm nội dung cần chuẩn bị..." className="field bg-gray-50"></textarea>
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full py-3 mt-4 text-base">{isProcessing ? 'Đang lưu...' : (editingId ? 'Cập nhật Sự kiện' : 'Tạo Sự kiện mới')}</button>
        </form>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PHẦN 2: THÔNG BÁO
// ---------------------------------------------------------------------------
function AnnouncementsSection() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const { session } = useAuth();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const announcements = appState?.posts?.filter(p => p.channel === 'announcement') || [];
  const filteredPosts = announcements.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.authorName.toLowerCase().includes(searchQuery.toLowerCase()));

  const gvcnPosts = filteredPosts.filter(p => p.column === 'gvcn');
  const bcsPosts = filteredPosts.filter(p => p.column === 'bcs');
  const memberPosts = filteredPosts.filter(p => p.column === 'member');

  const extractDriveId = (url: string) => { const m = url.match(/id=([a-zA-Z0-9_-]+)/); return m ? m[1] : null; };
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (timeStr.includes('T') && timeStr.includes('Z')) { const d = new Date(timeStr); return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
    return timeStr;
  };
  const isImageUrl = (type: string, name: string) => type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name);

  const SmartImage = ({ id, name, large, aspectClass }: { id: string, name: string, large?: boolean, aspectClass?: string }) => {
    const [stage, setStage] = useState<number>(0);
    if (stage === 2) {
      return (
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-900 relative shadow-sm" style={{ aspectRatio: large ? 'auto' : '16/9', height: large ? '60vh' : 'auto', minHeight: '200px' }}>
          <iframe src={`https://drive.google.com/file/d/${id}/preview`} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />
        </div>
      );
    }
    const src = stage === 0 ? `https://drive.google.com/uc?export=view&id=${id}` : `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
    return <img src={src} alt={name} className={`w-full rounded-xl border border-gray-200 shadow-sm ${large ? 'max-h-[70vh] object-contain bg-gray-50' : `${aspectClass || 'aspect-video'} object-cover hover:opacity-95 transition`}`} onError={() => setStage(s => s + 1)} />;
  };

  const MediaGallery = ({ attachments, large = false }: { attachments: Attachment[], large?: boolean }) => {
    const images = attachments.filter(a => isImageUrl(a.type, a.name));
    const files = attachments.filter(a => !isImageUrl(a.type, a.name));
    return (
      <div className="mt-3 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((img, i) => {
              const id = extractDriveId(img.url);
              if (!id) return null;
              const isFullWidth = images.length === 1 || (images.length === 3 && i === 0);
              return <div key={i} className={isFullWidth ? 'col-span-1 sm:col-span-2' : 'col-span-1'}><SmartImage id={id} name={img.name} large={large} aspectClass={isFullWidth ? 'aspect-video' : 'aspect-square'} /></div>;
            })}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {files.map((file, i) => {
              const id = extractDriveId(file.url);
              return (
                <a key={i} href={id ? `https://drive.google.com/file/d/${id}/view` : file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-primary-700/40 hover:bg-primary-50/50 transition w-full sm:w-max">
                  <FileText size={18} className="text-primary-700 flex-shrink-0" /><span className="text-sm font-bold text-gray-700 truncate">{file.name}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      // Nén ảnh trước khi upload (cạnh dài ≤1200px, JPEG 72%) — trước đây
      // gửi thẳng base64 gốc của ảnh chụp điện thoại (thường 4-8MB), gây
      // treo UI khi mã hóa và dễ vượt thời gian khóa 25s của Apps Script.
      // File không phải ảnh (PDF, Word...) giữ nguyên fileToBase64.
      const filesData = await Promise.all(selectedFiles.map(async f => ({
        name: f.name,
        type: f.type.startsWith('image/') ? 'image/jpeg' : (f.type || 'application/octet-stream'),
        base64: f.type.startsWith('image/') ? await compressImage(f) : await fileToBase64(f),
      })));
      await api.call('POST_CREATE', { channel: 'announcement', title, content, category: 'general', files: filesData });
      await refreshData(); showToast('Đã đăng thông báo!', 'success');
      setIsCreateModalOpen(false); setTitle(''); setContent(''); setSelectedFiles([]);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingPost) return; setIsProcessing(true);
    try {
      await api.call('POST_EDIT', { id: editingPost.id, title, content });
      await refreshData(); showToast('Đã cập nhật!', 'success'); setIsEditModalOpen(false);
      if (viewingPost && viewingPost.id === editingPost.id) setViewingPost({ ...viewingPost, title, content });
      setEditingPost(null);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const PostCard = ({ post }: { post: Post }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPinning, setIsPinning] = useState(false);
    const canManage = session?.role === 'gvcn' || session?.username === post.authorId;
    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Xóa thông báo này?')) return;
      setIsDeleting(true);
      try { await api.call('POST_DELETE', { id: post.id }); await refreshData(); showToast('Đã xóa.', 'success'); }
      catch (err: any) { showToast(err.message, 'error'); } finally { setIsDeleting(false); }
    };
    const handleTogglePin = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPinning(true);
      try { await api.call('POST_PIN', { id: post.id, pinned: !post.pinned }); await refreshData(); showToast(post.pinned ? 'Đã bỏ ghim.' : 'Đã ghim thông báo!', 'success'); }
      catch (err: any) { showToast(err.message, 'error'); } finally { setIsPinning(false); }
    };
    return (
      <MagicCard className={cn('relative group hover:shadow-md transition bg-gradient-to-br from-rose-50/70 to-white', post.pinned ? 'border-red-200 hover:border-red-300' : 'border-rose-100 hover:border-rose-200')}>
        <div className="p-4 cursor-pointer" onClick={() => setViewingPost(post)}>
          {/* Badge phân loại theo mức độ quan trọng — thông báo được ghim
              hiện nổi bật hơn hẳn, khớp mẫu "QUAN TRỌNG"/"THÔNG BÁO" tham
              chiếu. Tận dụng field pinned có sẵn trong dữ liệu thay vì
              thêm field phân loại mới. */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className={cn('chip text-[10px]', post.pinned ? 'bg-red-50 text-red-700 border-red-200' : 'bg-primary-50 text-primary-700 border-primary-200')}>
              {post.pinned ? 'QUAN TRỌNG' : 'THÔNG BÁO'}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">{formatTime(post.time)}</span>
          </div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm">{post.authorName.charAt(0)}</div>
              <p className="text-sm font-bold text-gray-800 leading-tight">{post.authorName}</p>
            </div>
            {canManage && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={handleTogglePin} disabled={isPinning} className={cn('p-1.5 rounded', post.pinned ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50')} title={post.pinned ? 'Bỏ ghim' : 'Ghim thông báo quan trọng'}>
                  <Bookmark size={15} fill={post.pinned ? 'currentColor' : 'none'} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingPost(post); setTitle(post.title); setContent(post.content); setIsEditModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"><Edit3 size={15} /></button>
                <button onClick={handleDelete} disabled={isDeleting} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
              </div>
            )}
          </div>
          <h3 className="font-bold text-gray-900 mb-1 leading-snug">{post.title}</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-3 mb-2">{post.content}</p>
          {post.attachments && post.attachments.length > 0 && <MediaGallery attachments={post.attachments} />}
        </div>
      </MagicCard>
    );
  };

  const Column = ({ title, posts }: { title: string, posts: Post[] }) => {
    const [showArchive, setShowArchive] = useState(false);
    const isOldPost = (timeStr: string) => {
      if (!timeStr) return false;
      let postDate;
      if (timeStr.includes('T') && timeStr.includes('Z')) postDate = new Date(timeStr);
      else { const [day, month, year] = timeStr.split(' ')[0].split('/'); postDate = new Date(Number(year), Number(month) - 1, Number(day)); }
      return ((Date.now() - postDate.getTime()) / (1000 * 3600 * 24)) > 30;
    };
    // Ghim lên đầu — trước đây chỉ filter giữ nguyên thứ tự thời gian, tin
    // ghim có thể nằm giữa/cuối danh sách nếu có tin mới hơn đăng sau, mất
    // hết ý nghĩa "quan trọng cần thấy ngay" của việc ghim.
    const activePosts = posts.filter(p => p.pinned || !isOldPost(p.time)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const archivedPosts = posts.filter(p => !p.pinned && isOldPost(p.time));
    return (
      // Mỗi cột cao TỰ NHIÊN theo nội dung — không còn max-h/overflow-y-auto
      // cắt ngang giữa card như trước. Bản cũ giới hạn 480px khiến card đầu
      // tiên (nhất là card có ảnh đính kèm) bị cắt cụt giữa chừng, tạo cảm
      // giác nội dung "biến mất" — đã xác nhận qua ảnh chụp thật. Trang giờ
      // cuộn dọc bình thường như mọi sản phẩm thương mại (Facebook, Slack):
      // an toàn tuyệt đối, không bao giờ cắt nội dung.
      <div className={cn(
        'flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-fit',
        activePosts.length === 0 && archivedPosts.length === 0 ? 'sticky top-20' : ''
      )}>
        <h3 className="text-sm font-sans font-bold text-primary-700 px-4 py-3 border-b border-gray-100 bg-gray-50/60">{title}</h3>
        <div className="flex flex-col gap-3 p-3">
          {activePosts.map(p => <PostCard key={p.id} post={p} />)}
          {activePosts.length === 0 && archivedPosts.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <Search size={18} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">Chưa có thông báo nào ở mục này</p>
            </div>
          )}
          {archivedPosts.length > 0 && (
            <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
              <button onClick={() => setShowArchive(!showArchive)} className="w-full p-2.5 flex justify-between items-center text-xs font-bold text-gray-600 hover:bg-gray-100 transition">Kho lưu trữ ({archivedPosts.length}){showArchive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              {showArchive && <div className="p-2.5 flex flex-col gap-3 border-t border-gray-200 bg-gray-100/50">{archivedPosts.map(p => <PostCard key={p.id} post={p} />)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <h2 className="text-lg font-sans font-bold text-gray-900">Bảng tin thông báo</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm kiếm thông báo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-700 transition" />
          </div>
          <button onClick={() => { setTitle(''); setContent(''); setSelectedFiles([]); setIsCreateModalOpen(true); }} className="btn-primary flex-shrink-0"><Plus size={16} /> Đăng thông báo</button>
        </div>
      </div>

      {/* Bọc 3 cột trong khung nền mint nhạt — đồng bộ với khối Lịch trình
          bên dưới, đồng thời làm nổi bật các card trắng bên trong (trước
          đây 3 cột nằm trực tiếp trên nền trang, thiếu điểm phân định khu
          vực rõ ràng). Lưới đáp ứng: 1 cột trên di động, 3 cột từ màn lg.
          items-start ngăn Grid tự kéo giãn cột trống cao bằng cột có nhiều
          nội dung nhất. */}
      <div className="bg-gradient-to-br from-primary-50 to-sky-50 rounded-3xl border border-primary-100 shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Column title="Giáo viên Chủ nhiệm" posts={gvcnPosts} />
          <Column title="Ban cán sự lớp" posts={bcsPosts} />
          <Column title="Thành viên lớp" posts={memberPosts} />
        </div>
      </div>

      <Modal isOpen={!!viewingPost} onClose={() => setViewingPost(null)} title="Chi tiết thông báo" maxWidth="max-w-2xl">
        {viewingPost && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-sm">{viewingPost.authorName.charAt(0)}</div>
              <div><p className="font-bold text-gray-900">{viewingPost.authorName}</p><p className="text-xs text-gray-500">{formatTime(viewingPost.time)}</p></div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{viewingPost.title}</h2>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-base">{viewingPost.content}</p>
            </div>
            {viewingPost.attachments && viewingPost.attachments.length > 0 && <div className="pt-4 border-t border-gray-100"><MediaGallery attachments={viewingPost.attachments} large /></div>}
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Đăng thông báo mới">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field" /></div>
          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
              <Paperclip className="text-gray-400" size={20} /><span className="text-sm text-gray-600 font-medium">Bấm để đính kèm tệp (tối đa 5 tệp, mỗi tệp ≤ 20MB)</span>
              <input type="file" multiple className="hidden" onChange={e => {
                if (!e.target.files) return;
                const incoming = Array.from(e.target.files);
                const tooBig = incoming.filter(f => f.size > 20 * 1024 * 1024);
                if (tooBig.length > 0) { showToast(`Tệp "${tooBig[0].name}" vượt quá 20MB, vui lòng chọn tệp nhỏ hơn.`, 'error'); return; }
                const merged = [...selectedFiles, ...incoming];
                if (merged.length > 5) { showToast('Chỉ được đính kèm tối đa 5 tệp mỗi thông báo.', 'error'); return; }
                setSelectedFiles(merged);
              }} />
            </label>
            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">{selectedFiles.map((f, idx) => (<div key={idx} className="flex justify-between items-center p-2 bg-gray-100 rounded-lg text-sm"><span className="truncate flex-1 mr-4">{f.name}</span><button type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-primary-600 bg-white p-1 rounded-md shadow-sm"><X size={14} /></button></div>))}</div>
            )}
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full mt-2">{isProcessing ? 'Đang tải lên...' : 'Đăng thông báo'}</button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Sửa thông báo">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field"></textarea></div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">Cập nhật thay đổi</button>
        </form>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PHẦN 3: DẶN DÒ GVBM (T2 → CN, sáng/chiều, kèm deadline)
// ---------------------------------------------------------------------------
const NOTE_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const NOTE_SESSIONS: { key: 'sang' | 'chieu'; label: string }[] = [
  { key: 'sang', label: 'Sáng' },
  { key: 'chieu', label: 'Chiều' },
];
const CUSTOM_SUBJECT = '__CUSTOM__';
const DAY_LABELS: Record<string, string> = { T2: 'Thứ Hai', T3: 'Thứ Ba', T4: 'Thứ Tư', T5: 'Thứ Năm', T6: 'Thứ Sáu', T7: 'Thứ Bảy', CN: 'Chủ nhật' };

// Dữ liệu ngày trong hệ thống được lưu dạng chuỗi hiển thị "dd/mm/yyyy" (đã
// có sẵn trong Config blob từ trước), nhưng <input type="date"> của trình
// duyệt chỉ chấp nhận value theo ISO "yyyy-mm-dd". Hai hàm này chuyển đổi
// hai chiều để dùng lịch chọn ngày thay vì ô nhập tay tự do (dễ gõ sai định
// dạng, không kiểm tra được ngày hợp lệ) mà KHÔNG phá vỡ dữ liệu cũ đã lưu.
function dmyToIso(dmy: string): string {
  const m = String(dmy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function isoToDmy(iso: string): string {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function TeacherNotesSection() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const board = appState?.board;
  // Fallback: isLeader=true cũng được sửa bảng (khớp logic backend v18.0)
  const canManage = !!board?.canManage || session?.role === 'loptruong' || !!session?.isLeader;

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const notes: BoardNotes = board?.notes || {};
  const subjects = board?.subjects || [];

  const todayStr = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const openAdd = (key: string) => {
    if (!canManage) return;
    setEditingCell(key); setEditingNoteId(null);
    setSubject(''); setCustomSubject(''); setContent(''); setDeadline(''); setNoteDate(todayStr());
  };

  const openEdit = (key: string, n: TeacherNote) => {
    if (!canManage) return;
    setEditingCell(key); setEditingNoteId(n.id);
    const inList = subjects.includes(n.subject);
    setSubject(inList ? n.subject : CUSTOM_SUBJECT);
    setCustomSubject(inList ? '' : n.subject);
    setContent(n.content); setDeadline(n.deadline || ''); setNoteDate(n.date || todayStr());
  };

  const persist = async (next: BoardNotes) => {
    setIsProcessing(true);
    try { await api.call('BOARD_NOTES_SAVE', { notes: next }); await refreshData(); showToast('Đã lưu bảng dặn dò!', 'success'); setEditingCell(null); setEditingNoteId(null); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingCell) return;
    const finalSubject = subject === CUSTOM_SUBJECT ? customSubject.trim() : subject;
    if (!finalSubject || !content.trim()) return;
    const cellNotes = [...(notes[editingCell] || [])];
    if (editingNoteId) {
      // Sửa ghi chú hiện có
      const idx = cellNotes.findIndex(n => n.id === editingNoteId);
      if (idx >= 0) cellNotes[idx] = { ...cellNotes[idx], subject: finalSubject, content, deadline, date: noteDate };
    } else {
      cellNotes.push({ id: String(Date.now()), subject: finalSubject, content, deadline, date: noteDate });
    }
    await persist({ ...notes, [editingCell]: cellNotes });
  };

  const handleRemove = async (cellKey: string, noteId: string) => {
    if (!confirm('Xóa dặn dò này?')) return;
    await persist({ ...notes, [cellKey]: (notes[cellKey] || []).filter(n => n.id !== noteId) });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-sans font-bold text-gray-900 flex items-center gap-2"><NotebookPen size={22} className="text-primary-700" /> Dặn dò từ Giáo viên bộ môn</h2>
        {canManage && <span className="text-[11px] font-bold text-gray-400">Bấm ô [+] để thêm · bấm bút chì để sửa</span>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-2.5 w-16 sticky left-0 bg-gray-100 z-10">Buổi</th>
              {NOTE_DAYS.map(d => <th key={d} className="p-2.5 text-center">{DAY_LABELS[d] || d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {NOTE_SESSIONS.map(s => (
              <tr key={s.key} className="align-top">
                <td className="p-2.5 font-bold text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">{s.label}</td>
                {NOTE_DAYS.map(d => {
                  const key = `${d}-${s.key}`;
                  const cell = notes[key] || [];
                  return (
                    <td key={key} className="p-1.5 min-w-[130px]">
                      <div className="space-y-1.5">
                        {cell.map(n => (
                          <div key={n.id} className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-primary-700 text-[11px] leading-tight">{n.subject}</span>
                              {canManage && (
                                <div className="flex gap-0.5 shrink-0">
                                  <button onClick={() => openEdit(key, n)} className="text-gray-400 hover:text-blue-600" title="Sửa"><Edit3 size={11} /></button>
                                  <button onClick={() => handleRemove(key, n.id)} className="text-gray-400 hover:text-red-600" title="Xóa"><Trash2 size={11} /></button>
                                </div>
                              )}
                            </div>
                            <p className="text-gray-700 mt-0.5 leading-snug">{n.content}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {n.date && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"><CalendarIcon size={9} /> {n.date}</span>}
                              {n.deadline && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"><Clock size={9} /> Hạn: {n.deadline}</span>}
                            </div>
                          </div>
                        ))}
                        {canManage && (
                          <button onClick={() => openAdd(key)} className="w-full py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-primary-500 hover:text-primary-700 transition text-[11px] font-bold">+</button>
                        )}
                        {!canManage && cell.length === 0 && <span className="text-gray-300 text-[11px]">—</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editingCell} onClose={() => { setEditingCell(null); setEditingNoteId(null); }} title={editingNoteId ? 'Sửa dặn dò' : 'Thêm dặn dò'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Môn học</label>
            <select required value={subject} onChange={e => setSubject(e.target.value)} className="field">
              <option value="" disabled>-- Chọn môn --</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={CUSTOM_SUBJECT}>✎ Nhập tên môn khác…</option>
            </select>
          </div>
          {subject === CUSTOM_SUBJECT && (
            <input type="text" required value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Tên môn mới..." className="field" />
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Nội dung dặn dò</label>
            <textarea required rows={3} value={content} onChange={e => setContent(e.target.value)} className="field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Ngày dặn dò</label>
              <input type="date" value={dmyToIso(noteDate)} onChange={e => setNoteDate(isoToDmy(e.target.value))} className="field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Deadline (tùy chọn)</label>
              <input type="text" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="VD: Nộp trước 20/9" className="field" />
            </div>
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : (editingNoteId ? 'Lưu chỉnh sửa' : 'Thêm vào bảng')}</button>
        </form>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PHẦN 4: THỜI KHÓA BIỂU — mỗi tiết gồm Môn + Giáo viên (khớp mẫu TKB thật),
// bấm ô để sửa giống thao tác Sơ đồ lớp.
// ---------------------------------------------------------------------------
// Bảng màu cố định cho các ô Thời khóa biểu theo môn học — dùng hash tên
// môn để luôn ra đúng 1 màu nhất quán (không đổi giữa các lần render/reload
// dù thứ tự subjects thay đổi). Giúp nhìn lướt qua bảng là nhận ra ngay môn
// nào nằm ở đâu, thay vì mọi ô đều cùng 1 màu primary-50 đơn điệu như trước.
const TKB_SUBJECT_PALETTE = [
  { bg: 'bg-primary-50', border: 'border-primary-200', text: 'text-primary-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
];
function colorForSubject(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return TKB_SUBJECT_PALETTE[hash % TKB_SUBJECT_PALETTE.length];
}

function TimetableSection() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const board = appState?.board;
  // Fallback isLeader giống TeacherNotesSection
  const canManage = !!board?.canManage || session?.role === 'loptruong' || !!session?.isLeader;

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportingTkb, setIsExportingTkb] = useState(false);

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<TkbMeta>({ semester: '', schoolYear: '', updatedDate: '', appliedDate: '' });

  const tkb: BoardTkb = board?.tkb || {};
  const meta: TkbMeta = board?.tkbMeta || { semester: 'Học kỳ I', schoolYear: '2026 - 2027', updatedDate: '', appliedDate: '' };
  const days = board?.tkbDays || [];
  const periods = board?.tkbPeriods || [];
  const subjects = board?.subjects || [];

  const openCell = (key: string) => {
    if (!canManage) return;
    const current = tkb[key];
    setEditingKey(key);
    setTeacher(current?.teacher || '');
    if (current?.subject && subjects.includes(current.subject)) { setSubject(current.subject); setCustomSubject(''); }
    else if (current?.subject) { setSubject(CUSTOM_SUBJECT); setCustomSubject(current.subject); }
    else { setSubject(''); setCustomSubject(''); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingKey) return;
    const finalSubject = subject === CUSTOM_SUBJECT ? customSubject.trim() : subject;
    const next: BoardTkb = { ...tkb };
    if (finalSubject) next[editingKey] = { subject: finalSubject, teacher: teacher.trim() };
    else delete next[editingKey];
    setIsProcessing(true);
    try { await api.call('BOARD_TKB_SAVE', { tkb: next }); await refreshData(); showToast('Đã lưu Thời khóa biểu!', 'success'); setEditingKey(null); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try { await api.call('BOARD_TKB_SAVE', { tkb, tkbMeta: metaDraft }); await refreshData(); showToast('Đã cập nhật thông tin TKB!', 'success'); setEditingMeta(false); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleDeleteSlot = async (key: string) => {
    if (!confirm('Xóa tiết học này khỏi thời khóa biểu?')) return;
    const next: BoardTkb = { ...tkb }; delete next[key];
    setIsProcessing(true);
    try { await api.call('BOARD_TKB_SAVE', { tkb: next }); await refreshData(); showToast('Đã xóa tiết học.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  // Xuất Word để in — thuần phía client bằng thư viện "docx" (cùng khuôn với
  // conductExport.ts), không cần round-trip server. Mở cho MỌI người xem
  // trang này, không giới hạn canManage — export là hành động đọc, không
  // phải chỉnh sửa.
  const handleExportTkb = async () => {
    setIsExportingTkb(true);
    try {
      await exportTkbToWord(tkb, {
        semester: meta.semester,
        schoolYear: meta.schoolYear,
        appliedDate: meta.appliedDate,
        printDate: new Date().toLocaleDateString('vi-VN'),
        gvcn: 'Nguyễn Văn An',
      }, days, periods, `ThoiKhoaBieu_10CSU_${(meta.schoolYear || '').replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      showToast('Đã xuất file Word!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất Word: ' + err.message, 'error');
    } finally { setIsExportingTkb(false); }
  };

  const sangPeriods = periods.filter(p => p.session === 'sang');
  const chieuPeriods = periods.filter(p => p.session === 'chieu');

  // renderRows giờ trả về mảng <tr> phẳng thay vì <> Fragment với dòng label
  // ngang chiếm nguyên 1 hàng — ô "Buổi" đầu tiên dùng rowSpan bao trùm hết
  // số tiết thuộc buổi đó, đúng cấu trúc bảng thời khóa biểu chuẩn (cột dọc
  // bên trái ghi rõ Sáng/Chiều xuyên suốt các tiết, không phải dòng ngăn
  // cách rời rạc giữa các nhóm tiết như trước).
  const renderRows = (list: typeof periods, label: string, isMorning: boolean) => (
    list.map((p, idx) => (
      <tr key={p.key}>
        {idx === 0 && (
          <td rowSpan={list.length} className={cn('p-1 w-8 text-center align-middle sticky left-0 z-10 border-r-2', isMorning ? 'bg-amber-50 border-amber-200' : 'bg-primary-50 border-primary-200')}>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180 inline-block', isMorning ? 'text-amber-700' : 'text-primary-700')}>{label}</span>
          </td>
        )}
        <td className="p-2 w-20 sticky left-[32px] bg-white z-10 border-r border-gray-100">
          <span className="font-bold text-gray-700 block leading-tight">{p.label.split(' - ')[1]}</span>
          <span className="text-[9px] text-gray-400">{p.time}</span>
        </td>
        {days.map(d => {
          const key = `${d}-${p.key}`;
          const slot = tkb[key];
          const sc = slot ? colorForSubject(slot.subject) : null;
          return (
            <td key={key} className="p-1 align-top">
              <div className="relative">
                <button
                  onClick={() => openCell(key)}
                  disabled={!canManage}
                  className={`w-full min-h-[42px] px-1.5 py-1 rounded-lg leading-tight transition border text-center ${sc ? `${sc.bg} ${sc.border}` : 'bg-gray-50 border-dashed border-gray-200'} ${canManage ? 'hover:border-primary-500 cursor-pointer' : 'cursor-default'}`}
                  title={canManage ? (slot ? 'Bấm để sửa tiết' : 'Bấm để thêm tiết') : ''}
                >
                  {slot ? (
                    <>
                      <span className={`block text-[11px] font-bold ${sc!.text}`}>{slot.subject}</span>
                      {slot.teacher && <span className="block text-[9px] text-gray-500 mt-0.5">{slot.teacher}</span>}
                    </>
                  ) : <span className="text-[11px] font-bold text-gray-300">—</span>}
                </button>
                {canManage && slot && (
                  <div className="flex justify-end gap-0.5 mt-0.5">
                    <button onClick={() => openCell(key)} className="p-0.5 text-gray-400 hover:text-blue-600 rounded" title="Sửa tiết"><Edit3 size={11} /></button>
                    <button onClick={() => handleDeleteSlot(key)} className="p-0.5 text-gray-400 hover:text-red-600 rounded" title="Xóa tiết"><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    ))
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-bold text-gray-900 flex items-center gap-2"><CalendarIcon size={22} className="text-primary-700" /> Thời khóa biểu</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta.semester} — Năm học {meta.schoolYear}
            {meta.appliedDate && <span className="ml-2 text-gray-400">· Áp dụng {meta.appliedDate}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportTkb} disabled={isExportingTkb} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-[11px] font-bold rounded-xl hover:border-primary-400 hover:text-primary-700 transition disabled:opacity-60">
            <Download size={13} /> {isExportingTkb ? 'Đang tạo file...' : 'Xuất Word để in'}
          </button>
          {canManage && (
            <>
              <button onClick={() => { setMetaDraft(meta); setEditingMeta(true); }} className="text-[11px] font-bold text-gray-500 hover:text-primary-700 underline">Sửa thông tin</button>
              <span className="text-[11px] font-bold text-gray-400">Bấm ô để đổi tiết</span>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-2 w-8 sticky left-0 bg-gray-100 z-20"></th>
              <th className="p-2.5 w-20 sticky left-[32px] bg-gray-100 z-20 border-r border-gray-200">Tiết</th>
              {days.map(d => <th key={d} className="p-2.5 text-center">{DAY_LABELS[d] || d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {renderRows(sangPeriods, 'Buổi sáng', true)}
            {renderRows(chieuPeriods, 'Buổi chiều', false)}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editingKey} onClose={() => setEditingKey(null)} title="Thiết lập tiết học">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Môn học</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} className="field">
              <option value="">-- Để trống tiết này --</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={CUSTOM_SUBJECT}>✎ Nhập tên môn khác…</option>
            </select>
          </div>
          {subject === CUSTOM_SUBJECT && (
            <input type="text" required value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Tên môn mới..." className="field" />
          )}
          {(subject && subject !== '') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Giáo viên (tùy chọn)</label>
              <input type="text" value={teacher} onChange={e => setTeacher(e.target.value)} placeholder="VD: T-UPHƯƠNG, S-AN..." className="field" />
            </div>
          )}
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : 'Xác nhận'}</button>
        </form>
      </Modal>

      <Modal isOpen={editingMeta} onClose={() => setEditingMeta(false)} title="Thông tin Thời khóa biểu">
        <form onSubmit={handleSaveMeta} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Học kỳ</label><input type="text" value={metaDraft.semester} onChange={e => setMetaDraft({ ...metaDraft, semester: e.target.value })} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Năm học</label><input type="text" value={metaDraft.schoolYear} onChange={e => setMetaDraft({ ...metaDraft, schoolYear: e.target.value })} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Ngày cập nhật</label><input type="date" value={dmyToIso(metaDraft.updatedDate)} onChange={e => setMetaDraft({ ...metaDraft, updatedDate: isoToDmy(e.target.value) })} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Ngày áp dụng</label><input type="date" value={dmyToIso(metaDraft.appliedDate)} onChange={e => setMetaDraft({ ...metaDraft, appliedDate: isoToDmy(e.target.value) })} className="field" /></div>
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : 'Lưu thông tin'}</button>
        </form>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TRANG TỔNG QUAN — điểm vào duy nhất
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { session } = useAuth();
  const { appState, isLoading, error, refreshData } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) navigate('/');
    // Chỉ tự gọi refreshData khi CHƯA từng lỗi — nếu đã lỗi, dừng lại, chờ
    // người dùng bấm "Thử lại". Trước đây thiếu điều kiện !error nên lỗi nào
    // cũng khiến effect gọi lại BOOTSTRAP vô hạn ngay khi isLoading về false.
    else if (!appState && !isLoading && !error) refreshData();
  }, [session, appState, isLoading, error, navigate, refreshData]);

  if (isLoading || (!appState && !error)) {
    return <div className="min-h-screen flex items-center bg-gray-50"><Loader /></div>;
  }

  if (error && !appState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3 px-6 text-center">
        <AlertTriangle size={40} className="text-red-900" />
        <p className="font-bold text-gray-800">Không tải được dữ liệu từ máy chủ</p>
        <p className="text-sm text-gray-500 max-w-md">{error}</p>
        <button onClick={() => refreshData()} className="btn-primary mt-2">Thử lại</button>
      </div>
    );
  }

  if (!appState) return null; // không thể xảy ra thực tế — hai guard trên đã loại hết, chỉ để TS hẹp kiểu

  return (
    <Layout>
      <div className="space-y-8">
        {/* HEADER — đồng bộ kiểu card nền tối với Accounts/BCSStats/Conduct/
            ConductReport/CatalogEditor: bg-gray-900, chữ trắng, icon amber.
            Trước đây header trần (chữ đen trên nền trang) lệch hẳn phong
            cách các trang GVCN khác, gây cảm giác thiếu nhất quán hệ thống. */}
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><LayoutDashboard size={28} className="text-amber-400" /> Tổng quan lớp 10CSU</h1>
            <p className="text-gray-400 mt-1 text-sm">Xin chào, <span className="font-bold text-gray-200">{session?.name}</span></p>
          </div>
        </div>

        {/* Thông báo TRÊN, Timeline DƯỚI — xếp dọc full-width để 2 khối
            không chèn ép nhau theo chiều ngang. Mỗi khối cao tự nhiên theo
            nội dung, trang cuộn dọc bình thường như mọi web thương mại —
            không giới hạn chiều cao cứng có thể cắt cụt thông báo/sự kiện. */}
        <AnnouncementsSection />

        <hr className="border-gray-200" />

        <TimelineSection />

        <hr className="border-gray-200" />

        {/* DẶN DÒ GVBM */}
        <TeacherNotesSection />

        <hr className="border-gray-200" />

        {/* THỜI KHÓA BIỂU */}
        <TimetableSection />
      </div>
    </Layout>
  );
}