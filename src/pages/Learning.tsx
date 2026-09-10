import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Search, Download, BookOpen, FileText, Filter, X, UploadCloud, Trash2, MessageCircle, Send, ArrowLeft, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// Link API của anh
const GAS_URL = 'https://script.google.com/macros/s/AKfycbypce0ZsBQn0xwEjs_4NjiQc6J6eJLFjVnpKUTZjV13S8R3MtsN0RKD6n4Jg3pR_qtjsg/exec';

interface Comment { id: string; text: string; authorName: string; time: string; }
interface Material {
  id: string; title: string; subject: string; type: string; description: string;
  file_url: string; file_name: string; file_type: string; file_size_bytes: number;
  download_count: number; published_at: string; author_id: string; author_name: string;
  comments: Comment[];
}

const SUBJECTS = [
  { id: 'math', label: 'Toán', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'literature', label: 'Ngữ Văn', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 'english', label: 'Ngoại ngữ', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'history', label: 'Lịch sử', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'other', label: 'Khác', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

export default function Learning() {
  const { session } = useAuth(); // Lấy thông tin user đăng nhập
  const { showToast } = useToast();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('');
  
  // States cho Upload
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', subject: 'math', type: 'theory', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // States cho Split-View Modal (Xem chi tiết)
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. LẤY DỮ LIỆU ---
  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${GAS_URL}?action=list`);
      const result = await res.json();
      setMaterials(result.data);
      // Nếu đang mở modal xem chi tiết, tự động cập nhật data mới (để hiện bình luận vừa đăng)
      if (viewingMaterial) {
        const updated = result.data.find((m: Material) => m.id === viewingMaterial.id);
        if (updated) setViewingMaterial(updated);
      }
    } catch (e) { showToast('Lỗi tải dữ liệu kho học liệu', 'error'); }
    setLoading(false);
  }, [viewingMaterial, showToast]);

  useEffect(() => { loadMaterials(); }, []);
  useEffect(() => { document.body.style.overflow = viewingMaterial ? 'hidden' : 'unset'; }, [viewingMaterial]);

  // --- 2. UPLOAD ---
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadData.title) return;
    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const payload = {
        action: 'upload', title: uploadData.title, subject: uploadData.subject, type: uploadData.type,
        description: uploadData.description, fileName: selectedFile.name, mimeType: selectedFile.type,
        fileSize: selectedFile.size, base64Data: base64,
        authorId: session?.username, authorName: session?.name // Lấy từ phiên đăng nhập
      };

      try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
        const result = await res.json();
        if (result.success) {
          showToast('Tải tài liệu lên thành công!', 'success');
          setIsModalOpen(false); setUploadData({ title: '', subject: 'math', type: 'theory', description: '' }); setSelectedFile(null);
          loadMaterials();
        } else showToast(result.message, 'error');
      } catch (err) { showToast('Lỗi kết nối', 'error'); }
      setUploading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  // --- 3. BÌNH LUẬN ---
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !viewingMaterial) return;
    setIsProcessing(true);
    try {
      const payload = { action: 'comment', materialId: viewingMaterial.id, text: commentText, authorName: session?.name };
      await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
      setCommentText('');
      loadMaterials(); // Load lại để thấy comment
    } catch (err) { showToast('Lỗi khi gửi bình luận', 'error'); }
    setIsProcessing(false);
  };

  // --- 4. XÓA TÀI LIỆU ---
  const handleDelete = async (e: React.MouseEvent, m: Material) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa "${m.title}" không?`)) return;
    try {
      const payload = { action: 'delete', materialId: m.id };
      await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
      showToast('Đã xóa tài liệu', 'success');
      loadMaterials();
    } catch (err) { showToast('Lỗi khi xóa', 'error'); }
  };

  // --- 5. TẢI VỀ ---
  const handleDownload = (e: React.MouseEvent, m: Material) => {
    e.stopPropagation();
    fetch(`${GAS_URL}?action=increment&id=${encodeURIComponent(m.id)}`, { mode: 'no-cors' });
    setMaterials(prev => prev.map(item => item.id === m.id ? { ...item, download_count: item.download_count + 1 } : item));
    window.open(m.file_url, '_blank');
  };

  const getDrivePreviewUrl = (url: string) => {
    const match = url.match(/id=([a-zA-Z0-9_-]+)/);
    return match ? `https://drive.google.com/file/d/${match[1]}/preview` : url;
  };

  const filteredMaterials = materials.filter(m => 
    (!q || m.title.toLowerCase().includes(q.toLowerCase())) &&
    (!subject || m.subject === subject) && (!type || m.type === type)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-primary-800 to-primary-600 rounded-3xl p-6 md:p-8 text-white shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold flex items-center gap-3">
              <BookOpen size={36} className="text-amber-400" /> Kho Học liệu 10CSU
            </h1>
            <p className="text-primary-100 mt-2 font-medium">Chia sẻ, xem trước và thảo luận tài liệu học tập</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-white text-primary-700 hover:bg-gray-50 flex items-center gap-2 px-5 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95">
            <UploadCloud size={20} /> Đóng góp tài liệu
          </button>
        </div>

        {/* BỘ LỌC */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm kiếm tài liệu..." className="w-full bg-gray-50 border-none rounded-xl pl-11 py-3 text-sm focus:ring-2 focus:ring-primary-500 font-medium" />
          </div>
          <select value={subject} onChange={e => setSubject(e.target.value)} className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none">
            <option value="">Tất cả môn</option>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none">
            <option value="">Tất cả loại</option><option value="theory">Lý thuyết</option><option value="exercise">Bài tập</option>
          </select>
        </div>

        {/* DANH SÁCH LƯỚI TÀI LIỆU */}
        {loading ? (
          <div className="text-center py-20 text-gray-400"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>Đang tải kho dữ liệu...</div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200">Kho trống hoặc không tìm thấy tài liệu phù hợp.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredMaterials.map(m => {
              const subjConf = SUBJECTS.find(s => s.id === m.subject) || SUBJECTS[4];
              // Quyền Xóa: Là GVCN hoặc là người đăng tải
              const canDelete = session?.role === 'gvcn' || session?.username === m.author_id;
              
              return (
                <div key={m.id} onClick={() => setViewingMaterial(m)} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-300 transition-all cursor-pointer flex flex-col group relative">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-1 text-[10px] font-black uppercase rounded border ${subjConf.color}`}>{subjConf.label}</span>
                      {canDelete && (
                        <button onClick={(e) => handleDelete(e, m)} className="text-gray-300 hover:text-red-500 p-1 bg-white rounded-full transition absolute top-3 right-3 shadow-sm border border-gray-100 z-10 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 mb-2 group-hover:text-primary-600">{m.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">Bởi: <span className="font-bold text-gray-700">{m.author_name}</span></p>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Eye size={12}/> Xem trước</span>
                      <span className="flex items-center gap-1"><MessageCircle size={12}/> {m.comments?.length || 0}</span>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <span className="text-[11px] font-medium text-gray-400">{new Date(m.published_at).toLocaleDateString('vi-VN')}</span>
                    <button onClick={(e) => handleDownload(e, m)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 text-primary-700 hover:bg-primary-600 hover:text-white text-xs font-bold rounded-lg transition">
                      <Download size={14} /> Tải ({m.download_count})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL SPLIT-VIEW: XEM CHI TIẾT & BÌNH LUẬN (Học từ Cố Vấn) */}
      {viewingMaterial && (
        <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col animate-in fade-in zoom-in duration-200">
          {/* Header Split-view */}
          <div className="h-16 bg-white border-b border-gray-200 px-4 lg:px-8 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setViewingMaterial(null)} className="p-2 -ml-2 text-gray-500 hover:text-primary-700 rounded-full transition"><ArrowLeft size={24} /></button>
              <h2 className="font-bold text-gray-800 line-clamp-1">{viewingMaterial.title}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={(e) => handleDownload(e, viewingMaterial)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-bold text-sm rounded-xl hover:bg-primary-700 transition">
                <Download size={16} /> Tải tài liệu về
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Cột trái: Trình Xem Trước (Iframe Preview) */}
            <div className="w-full lg:w-2/3 h-full overflow-hidden bg-gray-900 relative">
               <iframe src={getDrivePreviewUrl(viewingMaterial.file_url)} className="w-full h-full border-none" allow="autoplay" />
            </div>

            {/* Cột phải: Thông tin & Bình luận */}
            <div className="w-full lg:w-1/3 bg-gray-50 flex flex-col h-[50vh] lg:h-full border-l border-gray-200 shadow-xl">
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{viewingMaterial.title}</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewingMaterial.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold uppercase">{viewingMaterial.author_name.charAt(0)}</div>
                    <span>Đăng bởi <b>{viewingMaterial.author_name}</b> • {new Date(viewingMaterial.published_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageCircle size={18} className="text-primary-600" /> Thảo luận ({viewingMaterial.comments?.length || 0})</h3>
                <div className="space-y-3">
                  {viewingMaterial.comments?.map(cmt => (
                    <div key={cmt.id} className="p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-bold text-gray-800">{cmt.authorName}</span>
                        <span className="text-[10px] text-gray-400">{new Date(cmt.time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{cmt.text}</p>
                    </div>
                  ))}
                  {(!viewingMaterial.comments || viewingMaterial.comments.length === 0) && <p className="text-sm text-gray-400 text-center italic mt-10">Chưa có bình luận nào. Hãy hỏi bài tại đây!</p>}
                </div>
              </div>

              {/* Ô nhập bình luận */}
              <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleCommentSubmit} className="flex gap-2 items-end">
                  <textarea rows={1} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Hỏi hoặc thảo luận về tài liệu này..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary-500 resize-none max-h-24 min-h-[46px]" />
                  <button type="submit" disabled={!commentText.trim() || isProcessing} className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition"><Send size={18} /></button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD TÀI LIỆU CŨ KẾ THỪA Ở ĐÂY... (Anh giữ nguyên phần form Upload như code cũ nhé) */}
      {isModalOpen && (
         <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
         <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
           <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><UploadCloud size={20} className="text-primary-600" /> Tải tài liệu lên kho</h2>
             <button onClick={() => !uploading && setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition"><X size={24} /></button>
           </div>
           <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
             <div><label className="block text-sm font-bold text-gray-700 mb-1">Tên tài liệu *</label><input required type="text" value={uploadData.title} onChange={e => setUploadData({...uploadData, title: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" /></div>
             <div className="flex gap-4">
               <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Môn học</label><select value={uploadData.subject} onChange={e => setUploadData({...uploadData, subject: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none bg-white">{SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
               <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Phân loại</label><select value={uploadData.type} onChange={e => setUploadData({...uploadData, type: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none bg-white"><option value="theory">Lý thuyết</option><option value="exercise">Bài tập</option></select></div>
             </div>
             <div><label className="block text-sm font-bold text-gray-700 mb-1">Mô tả (Nội dung / Số trang)</label><textarea rows={2} value={uploadData.description} onChange={e => setUploadData({...uploadData, description: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none resize-none" /></div>
             <div><label className="block text-sm font-bold text-gray-700 mb-1">Chọn File *</label><input required type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer border border-dashed border-gray-300 rounded-xl p-2" /></div>
             <button disabled={uploading} type="submit" className="w-full bg-primary-600 text-white font-bold text-sm px-4 py-3.5 rounded-xl hover:bg-primary-700 transition flex justify-center items-center gap-2 mt-4">{uploading ? 'Đang xử lý...' : 'Xác nhận Tải lên'}</button>
           </form>
         </div>
       </div>
      )}
    </Layout>
  );
}