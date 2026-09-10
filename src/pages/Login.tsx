import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';

import BackgroundImage from '../assets/bg-login.png'; 

// DANH SÁCH 41 THÀNH VIÊN LỚP 10CSU
const CLASS_ROSTER = [
  { username: 'gvcn_10csu', name: 'Nguyễn Văn An (GVCN)' },
  { username: 'hs01_10csu', name: 'Nguyễn Đình Thụy An' },
  { username: 'hs02_10csu', name: 'Nguyễn Huỳnh Khánh An' },
  { username: 'hs03_10csu', name: 'Trì Võ Trâm Anh' },
  { username: 'hs04_10csu', name: 'Nguyễn Đặng Thành Danh' },
  { username: 'hs05_10csu', name: 'Nguyễn Phương Đông' },
  { username: 'hs06_10csu', name: 'Huỳnh Nhật Duy' },
  { username: 'hs07_10csu', name: 'Phạm Nguyễn Bảo Hân' },
  { username: 'hs08_10csu', name: 'Lê Cảnh Hi' },
  { username: 'hs09_10csu', name: 'Nguyễn Khánh Hoàng' },
  { username: 'hs10_10csu', name: 'Nguyễn Minh Hùng' },
  { username: 'hs11_10csu', name: 'Nguyễn Minh Huy' },
  { username: 'hs12_10csu', name: 'Nguyễn Hà Anh Khoa' },
  { username: 'hs13_10csu', name: 'Trần Minh Khôi' },
  { username: 'hs14_10csu', name: 'Võ Lâm Kiệt' },
  { username: 'hs15_10csu', name: 'Châu Vĩnh Kỳ' },
  { username: 'hs16_10csu', name: 'Lê Thảo Linh' },
  { username: 'hs17_10csu', name: 'Nguyễn Khánh Linh' },
  { username: 'hs18_10csu', name: 'Nguyễn Chi Mai' },
  { username: 'hs19_10csu', name: 'Phan Nhật Minh' },
  { username: 'hs20_10csu', name: 'Quách Nhật Minh' },
  { username: 'hs21_10csu', name: 'Nguyễn Phạm Trúc My' },
  { username: 'hs22_10csu', name: 'Ngô Phương Nghi' },
  { username: 'hs23_10csu', name: 'Phạm Nguyễn Xuân Nghi' },
  { username: 'hs24_10csu', name: 'Đỗ Thảo Nhi' },
  { username: 'hs25_10csu', name: 'Lương Tuệ Nhi' },
  { username: 'hs26_10csu', name: 'Ngô Ngọc Nhi' },
  { username: 'hs27_10csu', name: 'Huỳnh Ngọc An Nhiên' },
  { username: 'hs28_10csu', name: 'Lê Quang Thành Phúc' },
  { username: 'hs29_10csu', name: 'Mai Xuân Phúc' },
  { username: 'hs30_10csu', name: 'Phạm Nguyễn Hồng Phúc' },
  { username: 'hs31_10csu', name: 'Đình Bảo Quỳnh' },
  { username: 'hs32_10csu', name: 'Trần Minh Uyên Thư' },
  { username: 'hs33_10csu', name: 'Lê Trần Phương Thủy' },
  { username: 'hs34_10csu', name: 'Nguyễn Nhã Cát Tiên' },
  { username: 'hs35_10csu', name: 'Nguyễn Minh Triết' },
  { username: 'hs36_10csu', name: 'Lại Gia Cát Tường' },
  { username: 'hs37_10csu', name: 'Lê Trấn Tường' },
  { username: 'hs38_10csu', name: 'Huỳnh Lệ Tuyền' },
  { username: 'hs39_10csu', name: 'Trần Thành Vinh' },
  { username: 'hs40_10csu', name: 'Đinh Thụy Thanh Vy' }
];

export default function Login() {
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { session, login } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !password) return;
    setIsSubmitting(true);
    try {
      const response = await api.call('LOGIN', { username: selectedUser.trim(), password });
      login(response);
      showToast(`Chào mừng ${response.name} đã quay lại!`, 'success');
      navigate('/dashboard');
    } catch (error: any) {
      showToast(error.message || 'Mã bảo mật không hợp lệ!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-gray-950"
      style={{
        backgroundImage: `url(${BackgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* LỚP GRADIENT MỜ Ở TRÊN VÀ DƯỚI ĐỂ BẢO VỆ CHỮ KHỎI BỊ CHÌM */}
      <div className="absolute top-0 w-full h-64 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-0"></div>
      <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-0"></div>

      {/* ==================================================== */}
      {/* THANH ĐĂNG NHẬP (TRÊN CÙNG) */}
      {/* ==================================================== */}
      <div className="relative z-20 w-full px-4 sm:px-8 pt-6 lg:pt-10 flex justify-center">
        <div className="w-full max-w-7xl bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] p-6 lg:px-10 lg:py-8 flex flex-col xl:flex-row items-center justify-between gap-8 transition-all relative overflow-hidden">
          
          <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[30deg] pointer-events-none"></div>

          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-xl shadow-amber-500/40 border border-white/20">
              <GraduationCap className="text-white w-8 h-8 lg:w-10 lg:h-10" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-wide font-sans leading-tight drop-shadow-lg">
                HẠC QUÁN SỬ THIÊN
              </h1>
              <p className="text-sm lg:text-base font-bold text-amber-400 uppercase tracking-widest drop-shadow-md mt-1">
                Không gian học thuật 10CSU
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            
            <div className="relative w-full sm:w-[280px] lg:w-[320px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={20} className="text-white/60" />
              </div>
              <select
                required
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white text-base lg:text-lg font-bold rounded-2xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block py-4 lg:py-5 pl-12 pr-10 appearance-none outline-none cursor-pointer hover:bg-black/50 transition-all shadow-inner"
              >
                <option value="" disabled className="text-gray-400 bg-gray-900 font-normal">
                  -- Nhấn để chọn định danh --
                </option>
                {CLASS_ROSTER.map((u) => (
                  <option key={u.username} value={u.username} className="text-gray-900 bg-white font-bold py-2">
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div className="relative w-full sm:w-[220px] lg:w-[260px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={20} className="text-white/60" />
              </div>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mã bảo mật..."
                className="w-full bg-black/40 border border-white/10 text-white text-base lg:text-lg font-bold rounded-2xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block py-4 lg:py-5 pl-12 pr-12 outline-none placeholder-gray-400 hover:bg-black/50 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/60 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedUser || !password}
              className="w-full sm:w-auto relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-base lg:text-lg rounded-2xl px-8 py-4 lg:py-5 shadow-[0_10px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed group flex-shrink-0 border border-amber-400/30"
            >
              <span className="relative flex items-center justify-center gap-3">
                {isSubmitting ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div></>
                ) : (
                  <><LogIn size={22} /> Khởi động</>
                )}
              </span>
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* ==================================================== */}
      {/* FOOTER CHUẨN Y HỆT CÁC TRANG BÊN TRONG (Kính mờ) */}
      {/* ==================================================== */}
      <div className="relative z-20 w-full bg-black/40 backdrop-blur-md border-t border-white/10 py-4 px-6 flex justify-center">
        <div className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <p className="text-[13px] font-medium text-gray-300 drop-shadow">
            © 2026 Hạc Quán Sử Thiên — Hệ thống Quản trị Không gian Học thuật
          </p>
          <p className="text-[13px] font-medium text-gray-300 drop-shadow">
            Develop by : <span className="font-bold text-amber-400">Thầy Nguyễn Văn An, Tổ Lịch Sử, Trường THPT Chuyên Lê Hồng Phong TP.HCM</span>
          </p>
        </div>
      </div>
    </div>
  );
}