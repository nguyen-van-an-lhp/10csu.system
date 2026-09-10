import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Crown } from 'lucide-react';
import type { User } from '../types';

// Trang Tổ chức lớp — suy ra hoàn toàn từ appState.roster (field group + isLeader).
// Không cần sheet Groups hay action GROUPS_AUTO/GROUPS_SAVE (cả hai không tồn tại
// trong backend). Thay đổi tổ trưởng dùng USER_UPDATE đã có trong Code.gs v16+.

export default function Groups() {
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const isGvcn = session?.role === 'gvcn';

  const roster: User[] = appState?.roster?.filter(u => u.role !== 'gvcn') || [];

  // Nhóm học sinh theo tổ từ roster.group
  const groupMap: Record<number, User[]> = {};
  roster.forEach(u => {
    const g = u.group ?? 0;
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(u);
  });
  const groups = Object.entries(groupMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([gn, members]) => ({
      groupNo: Number(gn),
      members: members.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      leader: members.find(m => m.isLeader) || null,
    }));

  const unassigned = groupMap[0] || [];

  const handleSetLeader = async (member: User) => {
    if (!isGvcn) return;
    const groupNo = member.group;
    if (!groupNo) return;
    // Cảnh báo trước khi ghi đè: nếu thành viên này đang giữ một chức vụ
    // khác (Bí thư, Lớp phó...), phong Tổ trưởng sẽ THAY THẾ chức vụ đó —
    // mỗi tài khoản chỉ giữ đúng 1 Role tại một thời điểm (đúng kiến trúc:
    // Role gán duy nhất ở Quản lý tài khoản). Trước đây ghi đè âm thầm,
    // không báo trước, dễ khiến GVCN vô tình tước nhầm chức vụ đang có.
    if (member.role !== 'student' && !member.role.startsWith('to')) {
      const roleLabel = member.role === 'loptruong' ? 'Lớp trưởng' : member.role === 'hoctap' ? 'Lớp phó Học tập'
        : member.role === 'kyluat' ? 'Lớp phó Kỷ luật' : member.role === 'vannghe' ? 'Lớp phó Văn nghệ'
        : member.role === 'bithu' ? 'Bí thư' : member.role === 'thuquy' ? 'Thủ quỹ' : member.role;
      if (!confirm(`${member.name} hiện đang là ${roleLabel}. Phong Tổ trưởng sẽ THAY THẾ chức vụ này (mỗi người chỉ giữ 1 chức vụ). Tiếp tục?`)) return;
    }
    const prev = roster.find(u => u.group === groupNo && u.isLeader && u.id !== member.id);
    setIsProcessing(true);
    try {
      // Bỏ tổ trưởng cũ (nếu có)
      if (prev) await api.call('USER_UPDATE', { username: prev.id, isLeader: false });
      // Phong tổ trưởng mới
      await api.call('USER_UPDATE', { username: member.id, isLeader: true, role: `to${groupNo}` });
      await refreshData();
      showToast(`Đã phong ${member.name} làm Tổ trưởng Tổ ${groupNo}.`, 'success');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleRemoveLeader = async (member: User) => {
    if (!isGvcn) return;
    setIsProcessing(true);
    try {
      await api.call('USER_UPDATE', { username: member.id, isLeader: false, role: 'student' });
      await refreshData();
      showToast(`Đã hủy chức vụ Tổ trưởng của ${member.name}.`, 'success');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const GROUP_COLORS: Record<number, string> = {
    1: 'border-t-rose-400', 2: 'border-t-blue-400', 3: 'border-t-emerald-400',
    4: 'border-t-amber-400', 5: 'border-t-purple-400', 6: 'border-t-cyan-400',
    7: 'border-t-pink-400', 8: 'border-t-lime-500',
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><Crown size={28} className="text-amber-400" /> Tổ chức lớp</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {groups.filter(g => g.groupNo > 0).length} tổ · {roster.length} học sinh
            {isGvcn && <span className="ml-2 text-gray-500">(Phân tổ và đổi tổ trưởng qua trang Sơ đồ lớp)</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {groups.filter(g => g.groupNo > 0).map(group => (
            <MagicCard key={group.groupNo} className={`p-5 flex flex-col border-t-4 ${GROUP_COLORS[group.groupNo] || 'border-t-gray-300'}`}>
              <div className="border-b border-gray-100 pb-3 mb-3">
                <h3 className="font-bold text-lg text-primary-700">Tổ {group.groupNo}</h3>
                <p className="text-xs text-gray-500">{group.members.length} thành viên{group.leader ? ` · Tổ trưởng: ${group.leader.name.split(' ').pop()}` : ' · Chưa có tổ trưởng'}</p>
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                {group.members.map(member => (
                  <div key={member.id} className={`group flex items-center justify-between px-2 py-1.5 rounded-lg transition ${member.isLeader ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'}`}>
                    <span className={`text-sm leading-tight ${member.isLeader ? 'font-bold text-amber-900' : 'text-gray-700 font-medium'}`}>
                      {member.name}
                    </span>
                    {member.isLeader ? (
                      <div className="flex items-center gap-1">
                        <Crown size={14} className="text-amber-500" />
                        {isGvcn && (
                          <button onClick={() => handleRemoveLeader(member)} disabled={isProcessing} className="text-[9px] font-bold text-amber-400 hover:text-red-600 ml-1 opacity-0 group-hover:opacity-100 transition" title="Hủy chức vụ">✕</button>
                        )}
                      </div>
                    ) : isGvcn ? (
                      <button onClick={() => handleSetLeader(member)} disabled={isProcessing}
                        className="text-[9px] uppercase font-bold text-gray-300 hover:text-amber-700 hover:bg-amber-50 px-2 py-0.5 rounded transition opacity-0 group-hover:opacity-100">
                        Phong TT
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </MagicCard>
          ))}
        </div>

        {unassigned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-800 mb-2">Chưa phân tổ ({unassigned.length} học sinh)</p>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map(u => <span key={u.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">{u.name}</span>)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}