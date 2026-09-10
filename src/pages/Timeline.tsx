import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Calendar as CalendarIcon, Clock, AlertCircle, BookOpen, Users, CheckCircle2, XCircle, Plus, Edit3, Trash2 } from 'lucide-react';
import type { TimelineEvent, TimelineType, TimelineStatus } from '../types';

export default function Timeline() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TimelineType>('deadline');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const events = appState?.timeline || [];
  
  // Quyền hạn thao tác (Bug 3: PM đã fix)
  const canManage = session?.role === 'gvcn' || ['loptruong', 'hoctap', 'kyluat', 'bithu'].includes(session?.role || '');

  // Sắp xếp sự kiện tăng dần theo ngày
  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Nhóm sự kiện theo ngày
  const groupedEvents = sortedEvents.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const resetForm = () => {
    setEditingId(null); setType('deadline'); setDate(''); setTimeSlot(''); setTitle(''); setDescription('');
  };

  const handleOpenCreate = () => { resetForm(); setIsModalOpen(true); };

  const handleOpenEdit = (e: TimelineEvent) => {
    setEditingId(e.id); setType(e.type); setDate(e.date); setTimeSlot(e.timeSlot); setTitle(e.title); setDescription(e.description);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      if (editingId) {
        await api.call('TIMELINE_EDIT', { id: editingId, type, date, timeSlot, title, description });
        showToast('Đã cập nhật sự kiện!', 'success');
      } else {
        await api.call('TIMELINE_CREATE', { type, date, timeSlot, title, description });
        showToast('Đã thêm sự kiện mới!', 'success');
      }
      await refreshData(); setIsModalOpen(false); resetForm();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sự kiện này khỏi lịch trình?')) return;
    setIsProcessing(true);
    try {
      await api.call('TIMELINE_DELETE', { id }); await refreshData(); showToast('Đã xóa sự kiện.', 'success');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleStatusChange = async (id: string, newStatus: TimelineStatus) => {
    setIsProcessing(true);
    try {
      await api.call('TIMELINE_STATUS', { id, status: newStatus }); await refreshData(); showToast('Cập nhật trạng thái thành công.', 'success');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  // UI Helpers
  const getTypeConfig = (t: TimelineType) => {
    switch(t) {
      case 'exam': return { icon: BookOpen, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Lịch thi/Kiểm tra' };
      case 'deadline': return { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Hạn chót (Deadline)' };
      case 'meeting': return { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Họp/Sinh hoạt' };
      case 'event': return { icon: CalendarIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Sự kiện ngoại khóa' };
      default: return { icon: CalendarIcon, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: 'Khác' };
    }
  };

  const formatDateDisplay = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-sans font-bold text-gray-900">Lịch trình & Sự kiện</h1>
            <p className="text-gray-500 mt-1">Quản lý Deadline, Lịch thi và Kế hoạch hoạt động lớp 10CSU</p>
          </div>
          {canManage && (
            <button onClick={handleOpenCreate} className="btn-primary w-full md:w-auto py-2.5 px-6 rounded-xl shadow-md hover:shadow-lg transition">
              <Plus size={20} /> Thêm sự kiện
            </button>
          )}
        </div>

        {/* TRỤC THỜI GIAN (VERTICAL TIMELINE) */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-16">
              <CalendarIcon size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Chưa có kế hoạch nào sắp tới.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-100 ml-4 md:ml-6 space-y-10">
              {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                <div key={date} className="relative pl-6 md:pl-10">
                  
                  {/* Dấu mốc Ngày */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 bg-primary-700 rounded-full border-4 border-white shadow-sm" />
                  <h2 className="text-lg font-bold text-primary-700 mb-4 capitalize">{formatDateDisplay(date)}</h2>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {dateEvents.map(evt => {
                      const cfg = getTypeConfig(evt.type);
                      const Icon = cfg.icon;
                      const isDone = evt.status === 'completed';
                      const isCancelled = evt.status === 'cancelled';
                      
                      return (
                        <div key={evt.id} className={`p-5 rounded-2xl border ${isDone ? 'bg-gray-50 border-gray-200 opacity-60' : isCancelled ? 'bg-primary-50/50 border-primary-100 opacity-50' : `bg-white ${cfg.border} shadow-sm`} transition hover:shadow-md group`}>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            
                            {/* Cột trái: Icon + Giờ + Tiêu đề */}
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-xl ${isDone || isCancelled ? 'bg-gray-200 text-gray-500' : cfg.bg + ' ' + cfg.color}`}>
                                <Icon size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isDone || isCancelled ? 'bg-gray-200 text-gray-600' : cfg.bg + ' ' + cfg.color}`}>{cfg.label}</span>
                                  {evt.timeSlot && <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded"><Clock size={12}/> {evt.timeSlot}</span>}
                                </div>
                                <h3 className={`text-lg font-bold ${isDone || isCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{evt.title}</h3>
                                {evt.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{evt.description}</p>}
                              </div>
                            </div>

                            {/* Cột phải: Thao tác (Bug 2: PM đã fix) */}
                            {canManage && (
                              <div className="flex sm:flex-col items-end gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4">
                                
                                <div className="flex gap-1">
                                  {evt.status !== 'completed' && (
                                    <button onClick={() => handleStatusChange(evt.id, 'completed')} disabled={isProcessing} className="p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition" title="Đánh dấu hoàn thành"><CheckCircle2 size={18}/></button>
                                  )}
                                  {evt.status !== 'cancelled' && (
                                    <button onClick={() => handleStatusChange(evt.id, 'cancelled')} disabled={isProcessing} className="p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition" title="Hủy sự kiện"><XCircle size={18}/></button>
                                  )}
                                  {evt.status !== 'pending' && (
                                    <button onClick={() => handleStatusChange(evt.id, 'pending')} disabled={isProcessing} className="p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition" title="Khôi phục trạng thái"><Clock size={18}/></button>
                                  )}
                                </div>

                                <div className="flex gap-1">
                                  <button onClick={() => handleOpenEdit(evt)} className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition" title="Chỉnh sửa"><Edit3 size={16}/></button>
                                  <button onClick={() => handleDelete(evt.id)} disabled={isProcessing} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Xóa bỏ"><Trash2 size={16}/></button>
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
      </div>

      {/* MODAL THÊM/SỬA SỰ KIỆN */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Cập nhật Lịch trình" : "Thêm Sự kiện mới"}>
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

          <button type="submit" disabled={isProcessing} className="btn-primary w-full py-3 mt-4 text-base">
            {isProcessing ? 'Đang lưu...' : (editingId ? 'Cập nhật Sự kiện' : 'Tạo Sự kiện mới')}
          </button>
        </form>
      </Modal>
    </Layout>
  );
}