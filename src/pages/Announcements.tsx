import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { fileToBase64 } from '../lib/file';
import { Trash2, Plus, Paperclip, ChevronDown, ChevronUp, Search, FileText, X, Edit3 } from 'lucide-react';
import type { Post, Attachment } from '../types';
import { groupByMonth } from '../lib/utils';

export default function Announcements() {
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

  // --- CÁC HÀM TIỆN ÍCH ---
  const extractDriveId = (url: string) => { const m = url.match(/id=([a-zA-Z0-9_-]+)/); return m ? m[1] : null; };
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (timeStr.includes('T') && timeStr.includes('Z')) {
      const d = new Date(timeStr); return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr;
  };
  const isImageUrl = (type: string, name: string) => type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name);

  // --- THUẬT TOÁN SMART IMAGE (3 LỚP PHÒNG THỦ CHỐNG LỖI) ---
  const SmartImage = ({ id, name, large, aspectClass }: { id: string, name: string, large?: boolean, aspectClass?: string }) => {
    const [stage, setStage] = useState<number>(0);
    
    // Nếu cả 2 luồng ảnh đều bị Google chặn, nhúng Iframe xem trước trực tiếp vào bài
    if (stage === 2) {
      return (
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-900 relative shadow-sm" style={{ aspectRatio: large ? 'auto' : '16/9', height: large ? '60vh' : 'auto', minHeight: '200px' }}>
          <iframe src={`https://drive.google.com/file/d/${id}/preview`} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />
        </div>
      );
    }

    const src = stage === 0 ? `https://drive.google.com/uc?export=view&id=${id}` : `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;

    return (
      <img 
        src={src} 
        alt={name} 
        className={`w-full rounded-xl border border-gray-200 shadow-sm ${large ? 'max-h-[70vh] object-contain bg-gray-50' : `${aspectClass || 'aspect-video'} object-cover hover:opacity-95 transition`}`} 
        onError={() => setStage(s => s + 1)} 
      />
    );
  };

  // --- THƯ VIỆN HIỂN THỊ MEDIA (CHUẨN FACEBOOK) ---
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
              return (
                <div key={i} className={isFullWidth ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
                  <SmartImage id={id} name={img.name} large={large} aspectClass={isFullWidth ? 'aspect-video' : 'aspect-square'} />
                </div>
              );
            })}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {files.map((file, i) => {
              const id = extractDriveId(file.url);
              return (
                <a key={i} href={id ? `https://drive.google.com/file/d/${id}/view` : file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-primary-700/40 hover:bg-primary-50/50 transition w-full sm:w-max">
                  <FileText size={18} className="text-primary-700 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700 truncate">{file.name}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // --- API HANDLERS ---
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

  // --- HIỂN THỊ THẺ BÀI ---
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
      <MagicCard className="relative group hover:border-primary-700/40 hover:shadow-md transition">
        <div className="p-4 cursor-pointer" onClick={() => setViewingPost(post)}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm">{post.authorName.charAt(0)}</div>
              <div><p className="text-sm font-bold text-gray-800 leading-tight">{post.authorName}</p><p className="text-[10px] text-gray-500">{formatTime(post.time)}</p></div>
            </div>
            {canManage && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
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

  // Nhóm nhỏ theo THÁNG bên trong Kho lưu trữ — gập mặc định, chỉ bung khi
  // bấm, để không đổ hết hàng trăm bài cũ ra cùng lúc dù đã mở "Kho lưu trữ".
  const MonthBucket = ({ label, items }: { label: string; items: Post[] }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="w-full px-3 py-2 flex justify-between items-center text-xs font-bold text-gray-500 hover:bg-gray-50 transition">
          <span>{label} ({items.length})</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {open && <div className="p-3 pt-1 flex flex-col gap-4 border-t border-gray-100">{items.map(p => <PostCard key={p.id} post={p} />)}</div>}
      </div>
    );
  };

  const Column = ({ title, posts }: { title: string, posts: Post[] }) => {
    const [showArchive, setShowArchive] = useState(false);
    const isOldPost = (timeStr: string) => {
      if (!timeStr) return false;
      let postDate;
      if (timeStr.includes('T') && timeStr.includes('Z')) postDate = new Date(timeStr);
      else {
        const [day, month, year] = timeStr.split(' ')[0].split('/');
        postDate = new Date(Number(year), Number(month) - 1, Number(day));
      }
      return ((Date.now() - postDate.getTime()) / (1000 * 3600 * 24)) > 30;
    };
    const activePosts = posts.filter(p => p.pinned || !isOldPost(p.time));
    const archivedPosts = posts.filter(p => !p.pinned && isOldPost(p.time));
    const archivedByMonth = groupByMonth(archivedPosts, p => p.time);

    return (
      <div className="flex-1 min-w-[320px] flex flex-col gap-4">
        <h2 className="text-xl font-sans font-bold text-primary-700 border-b-2 border-primary-700/20 pb-2">{title}</h2>
        <div className="flex flex-col gap-4">
          {activePosts.map(p => <PostCard key={p.id} post={p} />)}
          {activePosts.length === 0 && archivedPosts.length === 0 && <p className="text-sm text-gray-400 italic">Trống.</p>}
          {archivedPosts.length > 0 && (
            <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden mt-2">
              <button onClick={() => setShowArchive(!showArchive)} className="w-full p-3 flex justify-between items-center text-sm font-bold text-gray-600 hover:bg-gray-100 transition">Kho lưu trữ ({archivedPosts.length}){showArchive ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
              {showArchive && (
                <div className="p-3 space-y-2 border-t border-gray-200 bg-gray-100/50">
                  {archivedByMonth.map(g => <MonthBucket key={g.key} label={g.label} items={g.items} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input type="text" placeholder="Tìm kiếm thông báo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-700 transition" />
          </div>
          <button onClick={() => { setTitle(''); setContent(''); setSelectedFiles([]); setIsCreateModalOpen(true); }} className="btn-primary w-full md:w-auto"><Plus size={18} /> Đăng thông báo</button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start overflow-x-auto pb-4">
          <Column title="Giáo viên Chủ nhiệm" posts={gvcnPosts} />
          <Column title="Ban cán sự lớp" posts={bcsPosts} />
          <Column title="Tiếng nói Thành viên" posts={memberPosts} />
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
            {viewingPost.attachments && viewingPost.attachments.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <MediaGallery attachments={viewingPost.attachments} large />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Đăng thông báo mới">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field" /></div>
          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
              <Paperclip className="text-gray-400" size={20} /><span className="text-sm text-gray-600 font-medium">Bấm để đính kèm tệp</span>
              <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]); }} />
            </label>
            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">{selectedFiles.map((f, idx) => (<div key={idx} className="flex justify-between items-center p-2 bg-gray-100 rounded-lg text-sm"><span className="truncate flex-1 mr-4">{f.name}</span><button type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-primary-600 bg-white p-1 rounded-md shadow-sm"><X size={14} /></button></div>))}</div>
            )}
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full mt-2">{isProcessing ? 'Đang tải lên...' : 'Phát đi thông báo'}</button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Sửa thông báo">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Tiêu đề</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-gray-700">Nội dung</label><textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field"></textarea></div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">Cập nhật thay đổi</button>
        </form>
      </Modal>
    </Layout>
  );
}