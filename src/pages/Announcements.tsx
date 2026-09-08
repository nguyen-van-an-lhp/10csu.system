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

  const announcements = appState?.posts.filter(p => p.channel === 'announcement') || [];
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
        <div className="w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-900 relative shadow-sm" style={{ aspectRatio: large ? 'auto' : '16/9', height: large ? '60vh' : 'auto', minHeight: '200px' }}>
          <iframe src={`https://drive.google.com/file/d/${id}/preview`} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />
        </div>
      );
    }

    const src = stage === 0 ? `https://drive.google.com/uc?export=view&id=${id}` : `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;

    return (
      <img 
        src={src} 
        alt={name} 
        className={`w-full rounded-xl border border-stone-200 shadow-sm ${large ? 'max-h-[70vh] object-contain bg-stone-50' : `${aspectClass || 'aspect-video'} object-cover hover:opacity-95 transition`}`} 
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
                <a key={i} href={id ? `https://drive.google.com/file/d/${id}/view` : file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl hover:border-red-900/40 hover:bg-red-50/50 transition w-full sm:w-max">
                  <FileText size={18} className="text-red-900 flex-shrink-0" />
                  <span className="text-sm font-bold text-stone-700 truncate">{file.name}</span>
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
      else {
        const [day, month, year] = timeStr.split(' ')[0].split('/');
        postDate = new Date(Number(year), Number(month) - 1, Number(day));
      }
      return ((Date.now() - postDate.getTime()) / (1000 * 3600 * 24)) > 30;
    };
    const activePosts = posts.filter(p => p.pinned || !isOldPost(p.time));
    const archivedPosts = posts.filter(p => !p.pinned && isOldPost(p.time));

    return (
      <div className="flex-1 min-w-[320px] flex flex-col gap-4">
        <h2 className="text-xl font-serif font-bold text-red-900 border-b-2 border-red-900/20 pb-2">{title}</h2>
        <div className="flex flex-col gap-4">
          {activePosts.map(p => <PostCard key={p.id} post={p} />)}
          {activePosts.length === 0 && archivedPosts.length === 0 && <p className="text-sm text-stone-400 italic">Trống.</p>}
          {archivedPosts.length > 0 && (
            <div className="border border-stone-200 rounded-xl bg-stone-50 overflow-hidden mt-2">
              <button onClick={() => setShowArchive(!showArchive)} className="w-full p-3 flex justify-between items-center text-sm font-bold text-stone-600 hover:bg-stone-100 transition">Kho lưu trữ ({archivedPosts.length}){showArchive ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
              {showArchive && <div className="p-3 flex flex-col gap-4 border-t border-stone-200 bg-stone-100/50">{archivedPosts.map(p => <PostCard key={p.id} post={p} />)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
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
            {viewingPost.attachments && viewingPost.attachments.length > 0 && (
              <div className="pt-4 border-t border-stone-100">
                <MediaGallery attachments={viewingPost.attachments} large />
              </div>
            )}
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
    </Layout>
  );
}