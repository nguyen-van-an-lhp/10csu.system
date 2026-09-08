import type { Session } from '../types';

// Lấy link Google Script từ tệp .env
const API_URL: string = import.meta.env.VITE_API_URL || '';

let currentSession: Session | null = null;

// Hàm lưu token đăng nhập vào API để gửi kèm mỗi lần gọi
export function setApiSession(s: Session | null) { 
  currentSession = s; 
}

// Hàm cốt lõi: Gửi yêu cầu lên Google Sheet
export async function call<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
  if (!API_URL) throw new Error("Chưa cấu hình VITE_API_URL trong file .env");

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      username: currentSession?.username || '',
      token: currentSession?.token || '',
      data,
    }),
  });

  const body = await res.json();
  if (body.status !== 'success') {
    throw new Error(body.message || 'Yêu cầu bị từ chối.');
  }
  return body.data as T;
}

export const api = { call, setApiSession };