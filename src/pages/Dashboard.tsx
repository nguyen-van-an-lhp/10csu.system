import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Layout } from '../components/Layout';
import { MagicCard, Modal, Loader } from '../components/ui';
import { fileToBase64 } from '../lib/file';
import {
  Calendar as CalendarIcon, Clock, AlertCircle, AlertTriangle, BookOpen, Users, CheckCircle2, XCircle, Plus, Edit3, Trash2,
  Paperclip, ChevronDown, ChevronUp, Search, FileText, X, NotebookPen
} from 'lucide-react';
import type { Post, Attachment, TimelineEvent, TimelineType, TimelineStatus, BoardNotes, BoardTkb, TkbMeta } from '../types';

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
  const canManage = session?.role === 'gvcn' || ['loptruong', 'hoctap', 'kyluat', 'bithu'].includes(session?.role || '');

  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const groupedEvents = sortedEvents.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const resetForm = () => { setEditingId(null); setType('deadline'); setDate(''); setTimeSlot(''); setTitle(''); setDescription(''); };
  const handleOpenCreate = () => { resetForm(); setIsModalOpen(true); };
  const handleOpenEdit = (e: TimelineEvent) => {
    setEditingId(e.id); setType(e.type); setDate(e.date); setTimeSlot(e.timeSlot); setTitle(e.title); setDescription(e.description);
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
      default: return { icon: CalendarIcon, color: 'text-stone-600', bg: 'bg-stone-50', border: 'border-stone-200', label: 'Khác' };
    }
  };

  const formatDateDisplay = (dateString: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateString));

  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2"><CalendarIcon size={24} className="text-red-900" /> Lịch trình & Sự kiện</h2>
        {canManage && (
          <button onClick={handleOpenCreate} className="btn-primary w-full md:w-auto py-2.5 px-6 rounded-xl shadow-md hover:shadow-lg transition">
            <Plus size={20} /> Thêm sự kiện
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-sm">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-16">
            <CalendarIcon size={48} className="mx-auto text-stone-300 mb-4" />
            <p className="text-stone-500 font-medium">Chưa có kế hoạch nào sắp tới.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-stone-100 ml-4 md:ml-6 space-y-10">
            {Object.entries(groupedEvents).map(([d, dateEvents]) => (
              <div key={d} className="relative pl-6 md:pl-10">
                <div className="absolute -left-[9px] top-1 w-4 h-4 bg-red-900 rounded-full border-4 border-white shadow-sm" />
                <h3 className="text-lg font-bold text-red-900 mb-4 capitalize">{formatDateDisplay(d)}</h3>
                <div className="grid grid-cols-1 gap-4">
                  {dateEvents.map(evt => {
                    const cfg = getTypeConfig(evt.type);
                    const Icon = cfg.icon;
                    const isDone = evt.status === 'completed';
                    const isCancelled = evt.status === 'cancelled';
                    return (
                      <div key={evt.id} className={`p-5 rounded-2xl border ${isDone ? 'bg-stone-50 border-stone-200 opacity-60' : isCancelled ? 'bg-red-50/50 border-red-100 opacity-50' : `bg-white ${cfg.border} shadow-sm`} transition hover:shadow-md group`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${isDone || isCancelled ? 'bg-stone-200 text-stone-500' : cfg.bg + ' ' + cfg.color}`}><Icon size={24} /></div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isDone || isCancelled ? 'bg-stone-200 text-stone-600' : cfg.bg + ' ' + cfg.color}`}>{cfg.label}</span>
                                {evt.timeSlot && <span className="flex items-center gap-1 text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded"><Clock size={12} /> {evt.timeSlot}</span>}
                              </div>
                              <h4 className={`text-lg font-bold ${isDone || isCancelled ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{evt.title}</h4>
                              {evt.description && <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{evt.description}</p>}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex sm:flex-col items-end gap-2 border-t sm:border-t-0 sm:border-l border-stone-100 pt-3 sm:pt-0 sm:pl-4">
                              <div className="flex gap-1">
                                {evt.status !== 'completed' && <button onClick={() => handleStatusChange(evt.id, 'completed')} disabled={isProcessing} className="p-2 text-stone-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition" title="Đánh dấu hoàn thành"><CheckCircle2 size={18} /></button>}
                                {evt.status !== 'cancelled' && <button onClick={() => handleStatusChange(evt.id, 'cancelled')} disabled={isProcessing} className="p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition" title="Hủy sự kiện"><XCircle size={18} /></button>}
                                {evt.status !== 'pending' && <button onClick={() => handleStatusChange(evt.id, 'pending')} disabled={isProcessing} className="p-2 text-stone-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition" title="Khôi phục trạng thái"><Clock size={18} /></button>}
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleOpenEdit(evt)} className="p-2 text-stone-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition" title="Chỉnh sửa"><Edit3 size={16} /></button>
                                <button onClick={() => handleDelete(evt.id)} disabled={isProcessing} className="p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Xóa bỏ"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Cập nhật Lịch trình' : 'Thêm Sự kiện mới'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-stone-700">Phân loại</label>
              <select value={type} onChange={e => setType(e.target.value as TimelineType)} className="field bg-stone-50">
                <option value="exam">Kiểm tra / Thi</option>
                <option value="deadline">Hạn chót (Deadline)</option>
                <option value="meeting">Họp / Sinh hoạt</option>
                <option value="event">Sự kiện ngoại khóa</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-stone-700">Ngày diễn ra</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="field bg-stone-50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-700">Khung giờ (Tùy chọn)</label>
            <input type="text" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} placeholder="VD: Tiết 3 - 4, hoặc 19:00" className="field bg-stone-50" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-700">Tiêu đề Sự kiện / Công việc</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Nộp báo cáo chuyên đề Lịch sử" className="field bg-stone-50" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-700">Ghi chú chi tiết</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ghi chú thêm nội dung cần chuẩn bị..." className="field bg-stone-50"></textarea>
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

  const announcements = appState?.posts.filter(p => p.channel === 'announcement') || [];
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
        <div className="w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-900 relative shadow-sm" style={{ aspectRatio: large ? 'auto' : '16/9', height: large ? '60vh' : 'auto', minHeight: '200px' }}>
          <iframe src={`https://drive.google.com/file/d/${id}/preview`} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />
        </div>
      );
    }
    const src = stage === 0 ? `https://drive.google.com/uc?export=view&id=${id}` : `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
    return <img src={src} alt={name} className={`w-full rounded-xl border border-stone-200 shadow-sm ${large ? 'max-h-[70vh] object-contain bg-stone-50' : `${aspectClass || 'aspect-video'} object-cover hover:opacity-95 transition`}`} onError={() => setStage(s => s + 1)} />;
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
                <a key={i} href={id ? `https://drive.google.com/file/d/${id}/view` : file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl hover:border-red-900/40 hover:bg-red-50/50 transition w-full sm:w-max">
                  <FileText size={18} className="text-red-900 flex-shrink-0" /><span className="text-sm font-bold text-stone-700 truncate">{file.name}</span>
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
      const filesData = await Promise.all(selectedFiles.map(async f => ({ name: f.name, type: f.type || 'application/octet-stream', base64: await fileToBase64(f) })));
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
    const canManage = session?.role === 'gvcn' || session?.username === post.authorId;
    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Xóa thông báo này?')) return;
      setIsDeleting(true);
      try { await api.call('POST_DELETE', { id: post.id }); await refreshData(); showToast('Đã xóa.', 'success'); }
      catch (err: any) { showToast(err.message, 'error'); } finally { setIsDeleting(false); }
    };
    return (
      <MagicCard className="relative group hover:border-red-900/40 hover:shadow-md transition">
        <div className="p-4 cursor-pointer" onClick={() => setViewingPost(post)}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 text-red-800 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm">{post.authorName.charAt(0)}</div>
              <div><p className="text-sm font-bold text-stone-800 leading-tight">{post.authorName}</p><p className="text-[10px] text-stone-500">{formatTime(post.time)}</p></div>
            </div>
            {canManage && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={(e) => { e.stopPropagation(); setEditingPost(post); setTitle(post.title); setContent(post.content); setIsEditModalOpen(true); }} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded"><Edit3 size={15} /></button>
                <button onClick={handleDelete} disabled={isDeleting} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
              </div>
            )}
          </div>
          <h3 className="font-bold text-stone-900 mb-1 leading-snug">{post.title}</h3>
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed line-clamp-3 mb-2">{post.content}</p>
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
    const activePosts = posts.filter(p => p.pinned || !isOldPost(p.time));
    const archivedPosts = posts.filter(p => !p.pinned && isOldPost(p.time));
    return (
      <div className="flex-1 min-w-[320px] flex flex-col gap-4">
        <h3 className="text-xl font-serif font-bold text-red-900 border-b-2 border-red-900/20 pb-2">{title}</h3>
        <div className="flex flex-col gap-4">
          {activePosts.map(p => <PostCard key={p.id} post={p} />)}
          {activePosts.length === 0 && archivedPosts.length === 0 && <p className="text-sm text-stone-400 italic">Trống.</p>}
          {archivedPosts.length > 0 && (
            <div className="border border-stone-200 rounded-xl bg-stone-50 overflow-hidden mt-2">
              <button onClick={() => setShowArchive(!showArchive)} className="w-full p-3 flex justify-between items-center text-sm font-bold text-stone-600 hover:bg-stone-100 transition">Kho lưu trữ ({archivedPosts.length}){showArchive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
              {showArchive && <div className="p-3 flex flex-col gap-4 border-t border-stone-200 bg-stone-100/50">{archivedPosts.map(p => <PostCard key={p.id} post={p} />)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-serif font-bold text-stone-900">Thông báo</h2>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-3 text-stone-400" size={18} />
          <input type="text" placeholder="Tìm kiếm thông báo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-red-900 transition" />
        </div>
        <button onClick={() => { setTitle(''); setContent(''); setSelectedFiles([]); setIsCreateModalOpen(true); }} className="btn-primary w-full md:w-auto"><Plus size={18} /> Đăng thông báo</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start overflow-x-auto pb-4">
        <Column title="Giáo viên Chủ nhiệm" posts={gvcnPosts} />
        <Column title="Ban cán sự lớp" posts={bcsPosts} />
        <Column title="Tiếng nói Thành viên" posts={memberPosts} />
      </div>

      <Modal isOpen={!!viewingPost} onClose={() => setViewingPost(null)} title="Chi tiết thông báo" maxWidth="max-w-2xl">
        {viewingPost && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
              <div className="w-10 h-10 bg-red-100 text-red-800 rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-sm">{viewingPost.authorName.charAt(0)}</div>
              <div><p className="font-bold text-stone-900">{viewingPost.authorName}</p><p className="text-xs text-stone-500">{formatTime(viewingPost.time)}</p></div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 mb-4">{viewingPost.title}</h2>
              <p className="text-stone-800 whitespace-pre-wrap leading-relaxed text-base">{viewingPost.content}</p>
            </div>
            {viewingPost.attachments && viewingPost.attachments.length > 0 && <div className="pt-4 border-t border-stone-100"><MediaGallery attachments={viewingPost.attachments} large /></div>}
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Đăng thông báo mới">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-stone-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-stone-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field" /></div>
          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:bg-stone-50 transition">
              <Paperclip className="text-stone-400" size={20} /><span className="text-sm text-stone-600 font-medium">Bấm để đính kèm tệp</span>
              <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]); }} />
            </label>
            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">{selectedFiles.map((f, idx) => (<div key={idx} className="flex justify-between items-center p-2 bg-stone-100 rounded-lg text-sm"><span className="truncate flex-1 mr-4">{f.name}</span><button type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-red-600 bg-white p-1 rounded-md shadow-sm"><X size={14} /></button></div>))}</div>
            )}
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full mt-2">{isProcessing ? 'Đang tải lên...' : 'Phát đi thông báo'}</button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Sửa thông báo">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-stone-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-stone-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field"></textarea></div>
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

function TeacherNotesSection() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const board = appState?.board;
  const canManage = !!board?.canManage;

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const notes: BoardNotes = board?.notes || {};
  const subjects = board?.subjects || [];

  const openCell = (key: string) => {
    if (!canManage) return;
    setEditingCell(key); setSubject(''); setCustomSubject(''); setContent(''); setDeadline('');
  };

  const persist = async (next: BoardNotes) => {
    setIsProcessing(true);
    try { await api.call('BOARD_NOTES_SAVE', { notes: next }); await refreshData(); showToast('Đã lưu bảng dặn dò!', 'success'); setEditingCell(null); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingCell) return;
    const finalSubject = subject === CUSTOM_SUBJECT ? customSubject.trim() : subject;
    if (!finalSubject || !content.trim()) return;
    const next: BoardNotes = { ...notes, [editingCell]: [...(notes[editingCell] || []), { id: String(Date.now()), subject: finalSubject, content, deadline }] };
    await persist(next);
  };

  const handleRemove = async (cellKey: string, noteId: string) => {
    if (!confirm('Xóa dặn dò này?')) return;
    const next: BoardNotes = { ...notes, [cellKey]: (notes[cellKey] || []).filter(n => n.id !== noteId) };
    await persist(next);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 flex items-center gap-2"><NotebookPen size={22} className="text-red-900" /> Dặn dò từ Giáo viên bộ môn</h2>
        {canManage && <span className="text-[11px] font-bold text-stone-400">Bấm vào ô trống để thêm dặn dò</span>}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-stone-100 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-2.5 w-16 sticky left-0 bg-stone-100 z-10">Buổi</th>
              {NOTE_DAYS.map(d => <th key={d} className="p-2.5 text-center">{DAY_LABELS[d] || d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {NOTE_SESSIONS.map(s => (
              <tr key={s.key} className="align-top">
                <td className="p-2.5 font-bold text-stone-700 sticky left-0 bg-white z-10 border-r border-stone-100">{s.label}</td>
                {NOTE_DAYS.map(d => {
                  const key = `${d}-${s.key}`;
                  const cell = notes[key] || [];
                  return (
                    <td key={key} className="p-1.5 min-w-[130px]">
                      <div className="space-y-1.5">
                        {cell.map(n => (
                          <div key={n.id} className="group p-2 bg-stone-50 border border-stone-200 rounded-lg">
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-red-900 text-[11px] leading-tight">{n.subject}</span>
                              {canManage && <button onClick={() => handleRemove(key, n.id)} className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-600 shrink-0"><Trash2 size={12} /></button>}
                            </div>
                            <p className="text-stone-700 mt-0.5 leading-snug">{n.content}</p>
                            {n.deadline && <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"><Clock size={9} /> {n.deadline}</p>}
                          </div>
                        ))}
                        {canManage && (
                          <button onClick={() => openCell(key)} className="w-full py-1.5 border border-dashed border-stone-300 rounded-lg text-stone-400 hover:border-red-400 hover:text-red-700 transition text-[11px] font-bold">+</button>
                        )}
                        {!canManage && cell.length === 0 && <span className="text-stone-300 text-[11px]">—</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editingCell} onClose={() => setEditingCell(null)} title="Thêm dặn dò">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Môn học</label>
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
            <label className="text-xs font-bold text-stone-700">Nội dung dặn dò</label>
            <textarea required rows={3} value={content} onChange={e => setContent(e.target.value)} className="field" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Deadline (tùy chọn)</label>
            <input type="text" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="VD: Nộp trước 20/9, hoặc Tiết 3 thứ Sáu" className="field" />
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : 'Thêm vào bảng'}</button>
        </form>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PHẦN 4: THỜI KHÓA BIỂU — mỗi tiết gồm Môn + Giáo viên (khớp mẫu TKB thật),
// bấm ô để sửa giống thao tác Sơ đồ lớp.
// ---------------------------------------------------------------------------
function TimetableSection() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const board = appState?.board;
  const canManage = !!board?.canManage;

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const sangPeriods = periods.filter(p => p.session === 'sang');
  const chieuPeriods = periods.filter(p => p.session === 'chieu');

  const renderRows = (list: typeof periods, label: string) => (
    <>
      <tr className="bg-stone-50">
        <td colSpan={days.length + 1} className="px-2.5 py-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50">{label}</td>
      </tr>
      {list.map(p => (
        <tr key={p.key}>
          <td className="p-2 sticky left-0 bg-white z-10 border-r border-stone-100">
            <span className="font-bold text-stone-700 block leading-tight">{p.label.split(' - ')[1]}</span>
            <span className="text-[9px] text-stone-400">{p.time}</span>
          </td>
          {days.map(d => {
            const key = `${d}-${p.key}`;
            const slot = tkb[key];
            return (
              <td key={key} className="p-1 align-top">
                <button
                  onClick={() => openCell(key)}
                  disabled={!canManage}
                  className={`w-full min-h-[42px] px-1.5 py-1 rounded-lg leading-tight transition border text-center ${slot ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-dashed border-stone-200'} ${canManage ? 'hover:border-red-500 cursor-pointer' : 'cursor-default'}`}
                >
                  {slot ? (
                    <>
                      <span className="block text-[11px] font-bold text-red-900">{slot.subject}</span>
                      {slot.teacher && <span className="block text-[9px] text-stone-500 mt-0.5">{slot.teacher}</span>}
                    </>
                  ) : <span className="text-[11px] font-bold text-stone-300">—</span>}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 flex items-center gap-2"><CalendarIcon size={22} className="text-red-900" /> Thời khóa biểu</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {meta.semester} — Năm học {meta.schoolYear}
            {meta.appliedDate && <span className="ml-2 text-stone-400">· Áp dụng {meta.appliedDate}</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setMetaDraft(meta); setEditingMeta(true); }} className="text-[11px] font-bold text-stone-500 hover:text-red-900 underline">Sửa thông tin</button>
            <span className="text-[11px] font-bold text-stone-400">Bấm ô để đổi tiết</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[680px]">
          <thead className="bg-stone-100 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-2.5 w-20 sticky left-0 bg-stone-100 z-10">Tiết</th>
              {days.map(d => <th key={d} className="p-2.5 text-center">{DAY_LABELS[d] || d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {renderRows(sangPeriods, 'Buổi sáng')}
            {renderRows(chieuPeriods, 'Buổi chiều')}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editingKey} onClose={() => setEditingKey(null)} title="Thiết lập tiết học">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Môn học</label>
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
              <label className="text-xs font-bold text-stone-700">Giáo viên (tùy chọn)</label>
              <input type="text" value={teacher} onChange={e => setTeacher(e.target.value)} placeholder="VD: T-UPHƯƠNG, S-AN..." className="field" />
            </div>
          )}
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : 'Xác nhận'}</button>
        </form>
      </Modal>

      <Modal isOpen={editingMeta} onClose={() => setEditingMeta(false)} title="Thông tin Thời khóa biểu">
        <form onSubmit={handleSaveMeta} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Học kỳ</label><input type="text" value={metaDraft.semester} onChange={e => setMetaDraft({ ...metaDraft, semester: e.target.value })} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Năm học</label><input type="text" value={metaDraft.schoolYear} onChange={e => setMetaDraft({ ...metaDraft, schoolYear: e.target.value })} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Ngày cập nhật</label><input type="text" value={metaDraft.updatedDate} onChange={e => setMetaDraft({ ...metaDraft, updatedDate: e.target.value })} placeholder="03/09/2026" className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Ngày áp dụng</label><input type="text" value={metaDraft.appliedDate} onChange={e => setMetaDraft({ ...metaDraft, appliedDate: e.target.value })} placeholder="07/09/2026" className="field" /></div>
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
    return <div className="min-h-screen flex items-center bg-stone-50"><Loader /></div>;
  }

  if (error && !appState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3 px-6 text-center">
        <AlertTriangle size={40} className="text-red-900" />
        <p className="font-bold text-stone-800">Không tải được dữ liệu từ máy chủ</p>
        <p className="text-sm text-stone-500 max-w-md">{error}</p>
        <button onClick={() => refreshData()} className="btn-primary mt-2">Thử lại</button>
      </div>
    );
  }

  if (!appState) return null; // không thể xảy ra thực tế — hai guard trên đã loại hết, chỉ để TS hẹp kiểu

  return (
    <Layout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Tổng quan Phủ đệ</h1>
          <p className="text-stone-500 mt-1">Chào mừng <span className="font-bold">{session?.name}</span> đã trở lại hệ thống.</p>
        </div>

        <TimelineSection />
        <hr className="border-stone-200" />
        <AnnouncementsSection />
        <hr className="border-stone-200" />
        <TeacherNotesSection />
        <hr className="border-stone-200" />
        <TimetableSection />
      </div>
    </Layout>
  );
}