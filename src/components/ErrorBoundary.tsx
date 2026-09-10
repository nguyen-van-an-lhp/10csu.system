import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

// Bọc ngoài toàn bộ <Routes> trong App.tsx. Không có thành phần này, một
// exception ném ra ở BẤT KỲ đâu trong cây component (một trường undefined
// từ dữ liệu backend, một hàm gọi sai, một prop thiếu...) sẽ khiến React 18
// unmount toàn bộ ứng dụng — màn hình trắng hoàn toàn, không log rõ ràng,
// không cách nào biết lỗi nằm ở đâu nếu không mở DevTools Console thủ công.
// Với ErrorBoundary, lỗi được bắt lại đúng tại điểm xảy ra, hiển thị thông
// điệp + stack trace ngay trên màn hình, và người dùng có nút "Tải lại"
// thay vì phải tự đoán nguyên nhân.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In đầy đủ ra console để dev xem stack trace thật — đây chính là thứ
    // "trang trắng không manh mối" trước đây thiếu.
    console.error('[ErrorBoundary] Lỗi runtime:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 px-6 text-center">
          <AlertTriangle size={48} className="text-red-600" />
          <div>
            <p className="font-bold text-gray-900 text-lg">Đã xảy ra lỗi khi hiển thị trang</p>
            <p className="text-sm text-gray-500 max-w-lg mt-1">
              {this.state.error?.message || 'Lỗi không xác định.'}
            </p>
          </div>
          {/* Stack trace hiển thị trực tiếp — quan trọng để chẩn đoán nhanh
              thay vì phải mở DevTools thủ công mỗi lần gặp trang trắng. */}
          {this.state.error?.stack && (
            <pre className="text-left text-[11px] text-gray-400 bg-white border border-gray-200 rounded-xl p-4 max-w-2xl overflow-auto max-h-64 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn-primary mt-2 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}