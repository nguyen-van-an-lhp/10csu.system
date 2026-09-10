import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Save, Edit3, X, User, Download, Grid3X3 } from 'lucide-react';

type SeatData = { studentId: string | null; groupNo?: number | null };
type LayoutData = Record<string, SeatData>;

// Bảng màu Pastel Flat Design
const GROUP_COLORS: Record<number, string> = {
  1: 'bg-rose-50 border-rose-400 text-rose-900',
  2: 'bg-blue-50 border-blue-400 text-blue-900',
  3: 'bg-emerald-50 border-emerald-400 text-emerald-900',
  4: 'bg-amber-50 border-amber-400 text-amber-900',
  5: 'bg-purple-50 border-purple-400 text-purple-900',
  6: 'bg-cyan-50 border-cyan-400 text-cyan-900',
  7: 'bg-pink-50 border-pink-400 text-pink-900',
  8: 'bg-lime-50 border-lime-400 text-lime-900'
};

// Khớp đúng theo Role type chuẩn (types/index.ts) và ROLE_OPTIONS của
// Accounts.tsx — nơi DUY NHẤT gán chức vụ. Trước đây file này tự chế thêm
// 'vanthemy' và 'phobithu', hai tên KHÔNG tồn tại ở bất kỳ đâu khác trong hệ
// thống (backend ROLE_REPORT_SCOPE, Accounts.tsx, BCSStats.tsx đều dùng
// 'vannghe' và không có khái niệm phó bí thư) — khiến học sinh được gán 2
// tên này qua Sơ đồ (cũ) bị từ chối khi nộp báo cáo tuần dù đúng thực tế là
// Lớp phó Văn nghệ. Đã thống nhất một bộ từ vựng duy nhất.
const getOfficerBadge = (role: string) => {
  switch (role) {
    case 'loptruong': return { label: 'Lớp trưởng', short: 'LT', color: 'bg-primary-600' };
    case 'hoctap': return { label: 'Lớp phó Học tập', short: 'HT', color: 'bg-blue-600' };
    case 'kyluat': return { label: 'Lớp phó Kỷ luật', short: 'KL', color: 'bg-amber-600' };
    case 'vannghe': return { label: 'Lớp phó Văn nghệ', short: 'VN', color: 'bg-pink-500' };
    case 'bithu': return { label: 'Bí thư', short: 'BT', color: 'bg-emerald-600' };
    case 'thuquy': return { label: 'Thủ quỹ', short: 'TQ', color: 'bg-cyan-600' };
    case 'to1': return { label: 'Tổ trưởng 1', short: 'TT1', color: 'bg-purple-600' };
    case 'to2': return { label: 'Tổ trưởng 2', short: 'TT2', color: 'bg-purple-600' };
    case 'to3': return { label: 'Tổ trưởng 3', short: 'TT3', color: 'bg-purple-600' };
    case 'to4': return { label: 'Tổ trưởng 4', short: 'TT4', color: 'bg-purple-600' };
    case 'to5': return { label: 'Tổ trưởng 5', short: 'TT5', color: 'bg-purple-600' };
    case 'to6': return { label: 'Tổ trưởng 6', short: 'TT6', color: 'bg-purple-600' };
    case 'to7': return { label: 'Tổ trưởng 7', short: 'TT7', color: 'bg-purple-600' };
    case 'to8': return { label: 'Tổ trưởng 8', short: 'TT8', color: 'bg-purple-600' };
    default: return null;
  }
};

export default function SeatingChart() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isGvcn = session?.role === 'gvcn';

  const [layout, setLayout] = useState<LayoutData>({});
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [tempStudentId, setTempStudentId] = useState<string>('');
  const [tempGroupNo, setTempGroupNo] = useState<string>('');

  const allStudents = appState?.roster?.filter(u => u.role !== 'gvcn') || [];
  // Tra cứu Role trực tiếp từ roster theo username — nguồn chân lý DUY NHẤT
  // cho chức vụ giờ là Quản lý tài khoản (Accounts.tsx). Sơ đồ không còn
  // field officerRole tự do để GVCN gán đè tại đây; huy hiệu hiển thị luôn
  // đúng với Role thật của tài khoản, không thể lệch pha giữa 2 nơi.
  const roleOfStudent = (studentId: string | null | undefined) => allStudents.find(s => s.id === studentId)?.role || '';

  useEffect(() => {
    if (appState?.seating) setLayout(appState.seating);
  }, [appState?.seating]);

  const ROWS = 5;
  const COLS = 8;

  const handleSeatClick = (seatId: string) => {
    if (!isGvcn || !isEditingMode) return;
    const currentSeat = layout[seatId];
    setTempStudentId(currentSeat?.studentId || '');
    setTempGroupNo(currentSeat?.groupNo ? String(currentSeat.groupNo) : '');
    setEditingSeatId(seatId);
  };

  const handleConfirmSeatChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeatId) return;
    setLayout(prev => {
      const newLayout = { ...prev };
      if (tempStudentId) {
        Object.keys(newLayout).forEach(k => {
          if (newLayout[k]?.studentId === tempStudentId) newLayout[k] = { studentId: null, groupNo: null };
        });
      }
      newLayout[editingSeatId] = {
        studentId: tempStudentId || null,
        groupNo: tempGroupNo ? Number(tempGroupNo) : null,
      };
      return newLayout;
    });
    setEditingSeatId(null);
  };

  const handleSaveToServer = async () => {
    if (!isGvcn) return;
    setIsProcessing(true);
    try {
      // Sơ đồ chỉ gửi username + groupNo — backend không còn nhận officerRole
      // (Role được gán duy nhất ở Quản lý tài khoản, xem actSeatingSave_ v21.0).
      const groupAssignments: any[] = [];
      Object.values(layout).forEach(seat => {
        if (seat.studentId) groupAssignments.push({ username: seat.studentId, groupNo: seat.groupNo || null });
      });
      await api.call('SEATING_SAVE', { seating: layout, groupAssignments });
      await refreshData();
      showToast('Đã lưu Sơ đồ lớp!', 'success');
      setIsEditingMode(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintPDF = () => {
    const originalTitle = document.title;
    document.title = "Sơ đồ lớp 10CSU năm học 2026-2027";
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 100);
  };

  return (
    <Layout>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: Arial, sans-serif !important; background: white; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #printable-seating-chart, #printable-seating-chart * { visibility: visible; }
          
          #printable-seating-chart { 
            position: fixed; left: 0; top: 0; width: 100%; height: 100vh;
            background: white !important; padding: 0 !important; margin: 0 !important;
            display: flex; flex-direction: column; justify-content: space-between;
          }
          
          #printable-seating-chart * { 
            box-shadow: none !important; text-shadow: none !important; filter: none !important; 
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; 
          }
        }
      `}</style>

      <div className="space-y-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><Grid3X3 size={28} className="text-amber-400" /> Sơ đồ lớp học</h1>
            <p className="text-gray-400 text-sm mt-1">Chuẩn in ấn — Flat Design</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            <button onClick={handlePrintPDF} className="flex-1 xl:flex-none py-2 px-5 rounded-xl font-bold transition flex items-center justify-center gap-2 bg-black/20 text-gray-100 hover:bg-black/30 border border-white/10">
              <Download size={18} /> Xuất PDF
            </button>
            {isGvcn && (
              <>
                <button onClick={() => {
                  if (isEditingMode) { if (appState?.seating) setLayout(appState.seating); setIsEditingMode(false); }
                  else { setIsEditingMode(true); }
                }} className={`flex-1 xl:flex-none py-2 px-5 rounded-xl font-bold transition flex items-center justify-center gap-2 ${isEditingMode ? 'bg-black/20 text-gray-100 border border-white/10' : 'bg-primary-500/20 text-primary-100 border border-primary-400/40'}`}>
                  {isEditingMode ? <><X size={18} /> Hủy sửa</> : <><Edit3 size={18} /> Sửa Sơ đồ</>}
                </button>
                {/* Sửa bug: hover:bg-primary-700 trùng hệt màu nền tĩnh
                    (bg-primary-700) — hover không tạo ra thay đổi thị giác
                    nào, vô nghĩa. Đổi hover sang primary-600 (nhạt hơn) để
                    thật sự có phản hồi khi rê chuột. */}
                <button onClick={handleSaveToServer} disabled={!isEditingMode || isProcessing} className={`flex-1 xl:flex-none py-2 px-5 rounded-xl font-bold transition shadow-sm flex items-center justify-center gap-2 ${isEditingMode ? 'bg-primary-700 text-white hover:bg-primary-600' : 'bg-black/20 text-gray-400 cursor-not-allowed'}`}>
                  <Save size={18} /> {isProcessing ? 'Đang lưu...' : 'Lưu Sơ đồ'}
                </button>
              </>
            )}
          </div>
        </div>

        {isEditingMode && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-center font-bold text-sm shadow-sm animate-in fade-in">
            Bấm vào bàn để gắn tên Học sinh, phân Tổ và Chức danh.
          </div>
        )}

        <div id="printable-seating-chart" className="w-full overflow-x-auto bg-white p-6 print:p-0 rounded-2xl border border-gray-200 print:border-none shadow-sm print:shadow-none custom-scrollbar relative font-sans">
          <div className="min-w-[800px] print:min-w-full print:h-full flex flex-col items-center justify-between">
            
            <div className="w-full flex justify-between items-center mb-10 print:mb-0 px-2 print:px-8 print:pt-4">
              {/* v15.0: ĐÃ HOÁN ĐỔI — Bàn giáo viên chuyển sang trái, Cửa ra vào sang phải */}
              <div className="w-24 h-16 print:w-20 print:h-14 bg-gray-200 border-[3px] border-gray-300 rounded-lg flex flex-col items-center justify-center relative print:bg-gray-100">
                <span className="text-gray-600 font-bold text-[11px] print:text-[10px] text-center leading-tight uppercase">BÀN<br/>GIÁO VIÊN</span>
              </div>
              <div className="w-[60%] print:w-[65%] h-20 print:h-24 bg-gray-800 rounded-lg flex flex-col items-center justify-center print:bg-gray-800 py-3 relative border-4 border-gray-900">
                <span className="text-white font-sans font-bold tracking-widest text-xl print:text-2xl uppercase">SƠ ĐỒ LỚP 10CSU</span>
                <span className="text-gray-300 font-bold text-xs print:text-sm mt-1 uppercase tracking-wider">NĂM HỌC 2026 - 2027</span>
                <div className="w-1/2 border-t border-gray-600 border-dashed my-2"></div>
                <span className="text-amber-200 font-bold text-xs print:text-sm tracking-wide">GVCN: Nguyễn Văn An <span className="mx-3 opacity-50 font-normal">|</span> ĐT: 0326.830.265</span>
              </div>
              <div className="w-20 h-28 print:w-16 print:h-24 border-[3px] border-gray-300 border-dashed rounded-lg flex items-center justify-center bg-gray-50 print:bg-white relative">
                <span className="text-gray-400 font-bold text-xs print:text-[10px] text-center opacity-80 leading-tight">CỬA<br/>RA VÀO</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 print:gap-[14px] sm:gap-5 print:flex-1 print:justify-center w-full items-center">
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={`row-${r}`} className="flex justify-center w-full">
                  {Array.from({ length: COLS }).map((_, c) => {
                    const seatId = `${r}-${c}`;
                    const seat = layout[seatId] || { studentId: null, groupNo: null };
                    
                    const isAisle = c % 2 === 1 && c !== COLS - 1;
                    const student = allStudents.find(s => s.id === seat.studentId);
                    const isOccupied = !!seat.studentId;
                    
                    let seatClass = 'bg-gray-50 border-gray-300 border-dashed text-gray-400';
                    if (isOccupied) seatClass = seat.groupNo ? GROUP_COLORS[seat.groupNo] : 'bg-white border-gray-400 text-gray-800';
                    // Huy hiệu chức vụ đọc trực tiếp từ Role của tài khoản
                    // (gán tại Quản lý tài khoản) — không còn field officerRole
                    // riêng của sơ đồ, nên không thể lệch pha giữa 2 nơi.
                    const badge = isOccupied ? getOfficerBadge(roleOfStudent(seat.studentId)) : null;

                    return (
                      <div 
                        key={seatId} 
                        onClick={() => handleSeatClick(seatId)}
                        className={`relative w-16 h-16 sm:w-20 sm:h-20 print:w-[70px] print:h-[70px] rounded-xl border-2 print:border-[2px] flex flex-col items-center justify-center transition-all 
                          ${isEditingMode ? 'cursor-pointer hover:border-primary-500' : ''} 
                          ${seatClass} 
                          ${isAisle ? 'mr-10 sm:mr-16 print:mr-14' : 'mr-2 sm:mr-3 print:mr-3'}
                        `}
                      >
                        {seat.groupNo && isOccupied && <div className="absolute top-1 left-1.5 opacity-60 text-[10px] print:text-[9px] font-bold">T{seat.groupNo}</div>}
                        
                        {badge && isOccupied && (
                          <div className={`absolute -top-2 -right-2 print:-top-[6px] print:-right-[6px] ${badge.color} text-white text-[9px] print:text-[8px] px-1.5 py-0.5 print:px-[5px] print:py-[2px] rounded z-20 whitespace-nowrap font-bold`} title={badge.label}>
                            {badge.short}
                          </div>
                        )}
                        
                        {isOccupied ? (
                          <div className="text-[11px] sm:text-xs print:text-[11px] font-bold text-center leading-tight px-1 z-10">
                            {student?.name?.split(' ').slice(-2).join(' ')}
                          </div>
                        ) : (
                          <span className="opacity-40 text-[10px] print:text-[9px] font-bold">{r+1}-{c+1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-12 print:mt-0 w-full max-w-4xl print:max-w-none flex flex-col print:flex-row justify-between gap-6 print:gap-4 border-t-2 border-gray-200 print:border-gray-300 pt-6 print:pt-4 print:pb-4 print:px-8 text-left">
              <div className="flex-1">
                <h3 className="text-xs print:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 print:mb-2">Màu sắc Tổ</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <div key={n} className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 print:w-3.5 print:h-3.5 rounded border-2 ${GROUP_COLORS[n]}`}></div>
                      <span className="text-[11px] print:text-[10px] font-bold text-gray-700 uppercase">Tổ {n}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-[1.5]">
                <h3 className="text-xs print:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 print:mb-2">Ký hiệu Ban cán sự</h3>
                <div className="grid grid-cols-3 print:grid-cols-4 gap-y-2 gap-x-2">
                  {[
                    { id: 'loptruong', name: 'Lớp trưởng' }, 
                    { id: 'hoctap', name: 'Lớp phó Học tập' }, 
                    { id: 'kyluat', name: 'Lớp phó Kỷ luật' },
                    { id: 'vannghe', name: 'Lớp phó Văn nghệ' }, 
                    { id: 'bithu', name: 'Bí thư' }, 
                    { id: 'thuquy', name: 'Thủ quỹ' },
                    { id: 'to1', name: 'Tổ trưởng (1-8)' }
                  ].map(role => {
                    const badge = getOfficerBadge(role.id);
                    return (
                      <div key={role.id} className="flex items-center gap-1.5">
                        <div className={`flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded text-white text-[8px] print:text-[8px] font-bold ${badge?.color}`}>
                          {role.id === 'to1' ? 'TT' : badge?.short}
                        </div>
                        <span className="text-[11px] print:text-[10px] font-bold text-gray-700 uppercase">{role.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <Modal isOpen={!!editingSeatId} onClose={() => setEditingSeatId(null)} title={`Thiết lập Ghế ngồi`}>
        <form onSubmit={handleConfirmSeatChange} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={16} className="text-primary-700" /> Ai sẽ ngồi ghế này?</label>
            <select value={tempStudentId} onChange={e => setTempStudentId(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-primary-700 text-gray-800 font-medium text-sm">
              <option value="">-- Bỏ trống ghế này --</option>
              {allStudents.map(student => {
                const currentSeatOfStudent = Object.keys(layout).find(k => layout[k]?.studentId === student.id);
                return <option key={student.id} value={student.id}>{student.name} {currentSeatOfStudent && currentSeatOfStudent !== editingSeatId ? '(Sẽ nhấc khỏi ghế cũ)' : ''}</option>;
              })}
            </select>
          </div>

          {tempStudentId && (
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Phân vào Tổ mấy?</label>
              <select value={tempGroupNo} onChange={e => setTempGroupNo(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-primary-700 text-gray-800 font-medium text-sm">
                <option value="">-- Chưa phân tổ --</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Tổ {n}</option>)}
              </select>
            </div>
          )}

          {tempStudentId && (() => {
            const badge = getOfficerBadge(roleOfStudent(tempStudentId));
            return (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Chức danh Ban cán sự</label>
                {badge ? (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${badge.color}`}>{badge.short}</span>
                    <span className="text-sm font-medium text-gray-700">{badge.label}</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 italic">Không có chức danh</div>
                )}
                {/* Chức danh giờ chỉ được gán/sửa ở Quản lý tài khoản — Sơ đồ
                    chỉ hiển thị đúng theo dữ liệu đã gán, tránh 2 nơi ghi đè
                    lẫn nhau gây sai lệch. */}
                <p className="text-[11px] text-gray-400">Muốn đổi chức danh? Vào <span className="font-bold text-gray-500">Quản lý tài khoản</span> để cập nhật.</p>
              </div>
            );
          })()}

          <div className="pt-3 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={() => setEditingSeatId(null)} className="btn-secondary flex-1 py-2">Hủy bỏ</button>
            <button type="submit" className="btn-primary flex-1 py-2">Xác nhận</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}