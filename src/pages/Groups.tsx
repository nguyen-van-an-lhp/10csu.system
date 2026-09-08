import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Crown, Wand2 } from 'lucide-react';

export default function Groups() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const groups = appState?.groups || [];
  const students = appState?.roster.filter(u => u.role === 'student') || [];

  // Nút quyền lực: Chia lại toàn bộ tổ tự động
  const handleAutoGroup = async () => {
    if (!confirm('Hành động này sẽ xếp lại toàn bộ học sinh vào 8 tổ theo danh sách. Bạn có chắc chắn?')) return;
    setIsProcessing(true);
    try {
      await api.call('GROUPS_AUTO', { groupSize: 5, groupCount: 8 });
      await refreshData();
      showToast('Đã tự động chia 8 tổ thành công!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Nút phong tước: Cấp quyền Tổ trưởng cho một học sinh
  const handleSetLeader = async (groupNo: number, studentId: string) => {
    setIsProcessing(true);
    try {
      const assignments = groups.map(g => {
        const memberIds = students.filter(s => s.group === g.groupNo).map(s => s.id);
        return {
          groupNo: g.groupNo,
          groupName: g.groupName,
          leaderId: g.groupNo === groupNo ? studentId : g.leaderId,
          memberIds: memberIds
        };
      });
      
      await api.call('GROUPS_SAVE', { assignments });
      await refreshData();
      showToast('Đã cập nhật Tổ trưởng thành công!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const isGvcn = session?.role === 'gvcn';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-900">Tổ chức lớp</h1>
            <p className="text-stone-500 mt-1">Cơ cấu 8 tổ × 5 thành viên</p>
          </div>
          {isGvcn && (
            <button onClick={handleAutoGroup} disabled={isProcessing} className="btn-primary bg-stone-800 hover:bg-stone-900 shadow-stone-900/20">
              <Wand2 size={18} /> {isProcessing ? 'Đang xử lý...' : 'Chia tổ tự động'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {groups.map(group => {
            const members = students.filter(s => s.group === group.groupNo);
            return (
              <MagicCard key={group.groupNo} className="p-5 flex flex-col h-full border-t-4 border-t-red-900/20">
                <div className="border-b border-stone-100 pb-3 mb-3">
                  <h3 className="font-bold text-lg text-red-900">{group.groupName}</h3>
                  <p className="text-xs text-stone-500">{members.length} thành viên</p>
                </div>
                
                <div className="flex-1 flex flex-col gap-2">
                  {members.map(member => {
                    const isLeader = member.id === group.leaderId;
                    return (
                      <div 
                        key={member.id} 
                        className={`group flex items-center justify-between p-2 rounded-lg transition ${isLeader ? 'bg-amber-50 border border-amber-200' : 'hover:bg-stone-50'}`}
                      >
                        <span className={`text-sm ${isLeader ? 'font-bold text-amber-900' : 'text-stone-700 font-medium'}`}>
                          {member.name}
                        </span>
                        
                        {isLeader ? (
                          <Crown size={16} className="text-amber-500 drop-shadow-sm" />
                        ) : (
                          isGvcn && (
                            <button 
                              onClick={() => handleSetLeader(group.groupNo, member.id)}
                              disabled={isProcessing}
                              className="text-[10px] uppercase font-bold text-stone-400 hover:text-amber-700 bg-white border border-stone-200 hover:border-amber-300 hover:bg-amber-50 px-2 py-1 rounded transition opacity-0 group-hover:opacity-100"
                            >
                              Phong Tổ trưởng
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                  {members.length === 0 && (
                    <p className="text-sm text-stone-400 italic text-center py-4">Chưa có thành viên</p>
                  )}
                </div>
              </MagicCard>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}