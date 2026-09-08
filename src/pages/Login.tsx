import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Gọi API lên Google Sheet để kiểm tra tài khoản
      const res = await api.call('LOGIN', { username, password });
      login(res); // Lưu vào bộ nhớ máy
      navigate('/dashboard'); // Đẩy sang trang tổng quan
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 md:p-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif font-bold" style={{ color: 'var(--color-primary-900)' }}>
            Hạc Quán Sử Thiên
          </h1>
          <p className="text-stone-500 font-medium">Phiên bản Điều hành 5.0</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-700 ml-1">Định danh (Tài khoản)</label>
            <input 
              type="text" 
              required
              className="field"
              placeholder="VD: gvcn_10csu"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-700 ml-1">Mã khóa (Mật khẩu)</label>
            <input 
              type="password" 
              required
              className="field"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Đang mở trạm...' : 'Tiến vào hệ thống'}
          </button>
        </form>
      </div>
    </div>
  );
}