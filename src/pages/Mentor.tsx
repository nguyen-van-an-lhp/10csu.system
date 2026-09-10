import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { fileToBase64 } from '../lib/file';
import { compressImage } from '../lib/image';
import { MessageCircleQuestion, Trash2, Send, Paperclip, X, FileText, Reply as ReplyIcon, ShieldCheck, ArrowLeft } from 'lucide-react';
import type { Question, Reply, Attachment } from '../types';

export default function Mentor() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const { session } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingPost, setViewingPost] = useState<Question | null>(null); 
  
  const [subject, setSubject] = useState('Lịch sử');
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);

  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ id: string | null, name: string } | null>(null);

  const questions = appState?.mentor || [];
  const isGvcn = session?.role === 'gvcn';

  useEffect(() => {
    if (viewingPost) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [viewingPost]);

  // Đồng bộ viewingPost với dữ liệu mới nhất mỗi khi appState.mentor thay
  // đổi (sau refreshData()) — thay cho việc gọi thêm 1 lần BOOTSTRAP riêng
  // lẻ trong handleReplySubmit/handleVerify (trước đây gọi trùng 2 lần API
  // nặng nhất hệ thống cho mỗi bình luận/duyệt, tốn băng thông và làm chậm
  // thao tác rõ rệt trên mạng di động).
  useEffect(() => {
    if (!viewingPost) return;
    const fresh = questions.find(q => q.id === viewingPost.id);
    if (fresh && fresh !== viewingPost) setViewingPost(fresh);
  }, [questions, viewingPost]);

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
  const isImageFile = (f: File) => f.type.startsWith('image/');

  // Chuyển 1 File thành payload gửi backend: ảnh thì nén trước (giảm dung lượng
  // Drive, tải nhanh hơn), tệp khác giữ nguyên base64.
  const fileToPayload = async (f: File) => {
    const base64 = isImageFile(f) ? await compressImage(f) : await fileToBase64(f);
    return { name: f.name, type: f.type || 'application/octet-stream', base64 };
  };

  // Lưới xem trước tệp ĐÃ CHỌN nhưng CHƯA gửi — ảnh hiện thumbnail thật (đọc
  // trực tiếp từ máy qua object URL), tệp khác hiện thẻ tên. Nút X để bỏ.
  const PreviewGrid = ({ files, onRemove }: { files: File[], onRemove: (i: number) => void }) => {
    if (files.length === 0) return null;
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
        {files.map((f, idx) => (
          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            {isImageFile(f) ? (
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                <FileText size={20} className="text-primary-700 mb-1" />
                <span className="text-[9px] font-bold text-gray-600 line-clamp-2 leading-tight break-all">{f.name}</span>
              </div>
            )}
            <button type="button" onClick={() => onRemove(idx)} className="absolute top-1 right-1 bg-gray-900/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition" title="Bỏ tệp này">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

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
                <a key={i} href={id ? `https://drive.google.com/file/d/${id}/view` : file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-primary-700/40 hover:bg-primary-50/50 transition w-full sm:w-max max-w-full">
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
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      const filesData = await Promise.all(questionFiles.map(fileToPayload));
      await api.call('MENTOR_CREATE', { subject, question: questionText, isAnonymous, files: filesData });
      await refreshData(); showToast('Đã gửi câu hỏi!', 'success');
      setQuestionText(''); setIsAnonymous(false); setQuestionFiles([]);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!viewingPost || (!replyText.trim() && replyFiles.length === 0)) return;
    setIsProcessing(true);
    try {
      const filesData = await Promise.all(replyFiles.map(fileToPayload));
      await api.call('MENTOR_REPLY', { questionId: viewingPost.id, parentId: replyingTo?.id || null, content: replyText, files: filesData });
      await refreshData(); showToast('Đã đăng bình luận!', 'success');
      setReplyText(''); setReplyFiles([]); setReplyingTo(null);
      // viewingPost tự đồng bộ qua useEffect theo dõi appState.mentor ở trên
      // — không cần gọi thêm BOOTSTRAP riêng như trước.
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleVerify = async (replyId: string, currentState: boolean) => {
    if (!isGvcn || !viewingPost) return; setIsProcessing(true);
    try {
      await api.call('MENTOR_VERIFY', { questionId: viewingPost.id, replyId, isVerified: !currentState });
      await refreshData();
      // viewingPost tự đồng bộ qua useEffect theo dõi appState.mentor ở trên.
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); if (!confirm('Xóa câu hỏi này? Toàn bộ bình luận con sẽ bị xóa.')) return;
    setIsProcessing(true);
    try { await api.call('MENTOR_DELETE', { id }); await refreshData(); showToast('Đã xóa.', 'success'); setViewingPost(null); } 
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  // --- CÂY BÌNH LUẬN ---
  const CommentNode = ({ reply, allReplies, depth = 0 }: { reply: Reply, allReplies: Reply[], depth?: number }) => {
    const children = allReplies.filter(r => r.parentId === reply.id);
    return (
      <div className={`mt-4 ${depth > 0 ? 'ml-4 sm:ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className={`p-4 rounded-2xl ${reply.isVerified ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 text-gray-800 rounded-full flex items-center justify-center font-bold text-xs uppercase border border-gray-200">{reply.authorName.charAt(0)}</div>
              <div><p className={`text-sm font-bold ${reply.isVerified ? 'text-emerald-900' : 'text-gray-800'}`}>{reply.authorName}</p><p className="text-[10px] text-gray-500">{formatTime(reply.time)}</p></div>
            </div>
            {reply.isVerified && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><ShieldCheck size={12} /> Đã duyệt</span>}
          </div>
          
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
          {reply.attachments && reply.attachments.length > 0 && <MediaGallery attachments={reply.attachments} />}

          <div className="mt-3 flex items-center gap-4">
            <button onClick={() => setReplyingTo({ id: reply.id, name: reply.authorName })} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-primary-700 transition"><ReplyIcon size={14} /> Phản hồi</button>
            {isGvcn && <button onClick={() => handleVerify(reply.id, !!reply.isVerified)} disabled={isProcessing} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline">{reply.isVerified ? 'Bỏ duyệt' : 'Xác nhận chuẩn'}</button>}
          </div>
        </div>
        {children.map(child => <CommentNode key={child.id} reply={child} allReplies={allReplies} depth={depth + 1} />)}
      </div>
    );
  };

  const getSubjectColor = (s: string) => {
    if(s==='Lịch sử') return 'bg-amber-100 text-amber-800 border-amber-200';
    if(s==='Toán học') return 'bg-blue-100 text-blue-800 border-blue-200';
    if(s==='Ngữ văn') return 'bg-pink-100 text-pink-800 border-pink-200';
    if(s==='Tiếng Anh') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><MessageCircleQuestion size={28} className="text-amber-400" /> Cố vấn Học thuật</h1>
          <p className="text-gray-400 mt-1 text-sm">Hỏi đáp, đính kèm bài tập và thảo luận chuyên sâu</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/3">
            <MagicCard className="p-6 sticky top-24 border-t-4 border-t-primary-700/40">
              <div className="flex items-center gap-2 mb-4 text-primary-700"><MessageCircleQuestion size={24} /><h2 className="text-xl font-bold font-sans">Đặt câu hỏi mới</h2></div>
              <form onSubmit={handleAsk} className="space-y-4">
                <select value={subject} onChange={e => setSubject(e.target.value)} className="field">
                  <option value="Lịch sử">Lịch sử (Chuyên)</option><option value="Toán học">Toán học</option><option value="Ngữ văn">Ngữ văn</option><option value="Tiếng Anh">Tiếng Anh</option><option value="Khác">Khác...</option>
                </select>
                <textarea required rows={4} value={questionText} onChange={e => setQuestionText(e.target.value)} className="field" placeholder="Thầy ơi, giải giúp em bài này..."></textarea>
                
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                  <Paperclip className="text-gray-400" size={18} /><span className="text-sm text-gray-600 font-medium">Đính kèm ảnh / Đề bài</span>
                  <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setQuestionFiles([...questionFiles, ...Array.from(e.target.files)]); }} />
                </label>
                {questionFiles.length > 0 && (
                  <PreviewGrid files={questionFiles} onRemove={i => setQuestionFiles(questionFiles.filter((_, idx) => idx !== i))} />
                )}
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="rounded border-gray-300 text-primary-700 focus:ring-primary-700" />
                  <span className="text-sm text-gray-600 font-medium">Hỏi ẩn danh</span>
                </label>
                <button type="submit" disabled={isProcessing || !questionText.trim()} className="btn-primary w-full shadow-primary-700/20 mt-2">{isProcessing ? 'Đang tải lên...' : <><Send size={16} /> Gửi câu hỏi</>}</button>
              </form>
            </MagicCard>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col gap-4">
            {questions.map(q => (
              <MagicCard key={q.id} className="cursor-pointer hover:border-primary-700/40 hover:shadow-md transition overflow-hidden">
                <div onClick={() => setViewingPost(q)} className="h-full flex flex-col">
                  <div className="p-5 border-b border-gray-100 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded border uppercase ${getSubjectColor(q.subject)}`}>{q.subject}</span>
                        <span className="text-sm font-bold text-gray-800">{q.askerDisplay}</span>
                        <span className="text-xs text-gray-400">• {formatTime(q.time)}</span>
                      </div>
                      {(isGvcn || session?.username === q.askerRealId) && (
                        <button onClick={(e) => handleDelete(e, q.id)} disabled={isProcessing} className="text-gray-400 hover:text-red-600 transition p-1 z-10"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed line-clamp-3 mb-2">{q.question}</p>
                    
                    {q.attachments && q.attachments.length > 0 && <MediaGallery attachments={q.attachments} />}
                  </div>
                  
                  <div className="px-5 py-3 bg-gray-50 flex justify-between items-center text-sm font-bold text-gray-500">
                    <span>{q.replies?.length || 0} bình luận & thảo luận</span><span className="text-primary-700">Bấm xem toàn màn hình ➔</span>
                  </div>
                </div>
              </MagicCard>
            ))}
            {questions.length === 0 && <div className="p-10 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-medium">Bảng cố vấn đang trống.</div>}
          </div>
        </div>
      </div>

      {viewingPost && (
        <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="h-16 bg-white border-b border-gray-200 px-4 lg:px-8 flex items-center justify-between flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => { setViewingPost(null); setReplyingTo(null); }} className="p-2 -ml-2 text-gray-500 hover:text-primary-700 hover:bg-primary-50 rounded-full transition"><ArrowLeft size={24} /></button>
              <div className="hidden sm:flex items-center gap-3 border-l border-gray-200 pl-4">
                <span className={`px-2 py-0.5 text-xs font-bold rounded border uppercase ${getSubjectColor(viewingPost.subject)}`}>{viewingPost.subject}</span>
                <span className="text-sm font-bold text-gray-800">Bài đăng của {viewingPost.askerDisplay}</span>
              </div>
            </div>
            <button onClick={() => { setViewingPost(null); setReplyingTo(null); }} className="p-2 text-gray-500 hover:text-primary-700 bg-gray-50 hover:bg-primary-50 rounded-full transition"><X size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="w-full lg:w-3/5 xl:w-2/3 h-full overflow-y-auto p-4 md:p-8 bg-gray-100 custom-scrollbar">
              <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex sm:hidden items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded border uppercase ${getSubjectColor(viewingPost.subject)}`}>{viewingPost.subject}</span>
                  <span className="text-sm font-bold text-gray-800">{viewingPost.askerDisplay}</span>
                </div>
                <p className="text-gray-400 text-sm mb-4 font-medium">Đăng lúc {formatTime(viewingPost.time)}</p>
                <p className="text-lg md:text-xl text-gray-900 whitespace-pre-wrap leading-relaxed font-medium">{viewingPost.question}</p>
                
                {viewingPost.attachments && viewingPost.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                     <MediaGallery attachments={viewingPost.attachments} large />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-2/5 xl:w-1/3 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col h-[60vh] lg:h-full flex-shrink-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.05)]">
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><MessageCircleQuestion className="text-primary-700" size={20} />{viewingPost.replies?.length || 0} Bình luận & Thảo luận</h3>
                <div className="space-y-2">
                  {viewingPost.replies?.filter(r => !r.parentId).map(rootReply => <CommentNode key={rootReply.id} reply={rootReply} allReplies={viewingPost.replies!} depth={0} />)}
                  {(!viewingPost.replies || viewingPost.replies.length === 0) && <div className="text-center p-8 text-gray-400 italic">Chưa có bình luận nào. Hãy là người đầu tiên!</div>}
                </div>
              </div>

              <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                {replyingTo && (
                  <div className="flex justify-between items-center mb-3 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 font-medium">
                    <span>Đang trả lời <span className="font-bold text-primary-700">@{replyingTo.name}</span></span><button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-primary-600"><X size={16} /></button>
                  </div>
                )}
                {replyFiles.length > 0 && (
                  <div className="mb-3">
                    <PreviewGrid files={replyFiles} onRemove={i => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))} />
                  </div>
                )}
                <form onSubmit={handleReplySubmit} className="flex items-end gap-2">
                  <label className="p-3 text-gray-400 hover:text-primary-700 bg-gray-50 hover:bg-primary-50 rounded-xl cursor-pointer transition flex-shrink-0 border border-gray-200">
                    <Paperclip size={20} /><input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setReplyFiles([...replyFiles, ...Array.from(e.target.files)]); }} />
                  </label>
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-700/20 focus-within:border-primary-700 transition flex">
                    <textarea rows={1} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={replyingTo ? 'Nhập phản hồi...' : 'Thêm bình luận mới...'} className="w-full bg-transparent p-3 text-sm focus:outline-none resize-none max-h-32 min-h-[46px]" />
                    <button type="submit" disabled={isProcessing || (!replyText.trim() && replyFiles.length === 0)} className="p-3 text-primary-700 hover:bg-primary-50 font-bold transition disabled:opacity-50"><Send size={20} /></button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}