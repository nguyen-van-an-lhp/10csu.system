const MAX_EDGE = 1200;
const QUALITY = 0.72;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Tệp được chọn không phải là ảnh.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ảnh hỏng hoặc không được hỗ trợ.'));
      img.onload = () => {
        let { width: w, height: h } = img;
        const edge = Math.max(w, h);
        
        // Thu nhỏ ảnh nếu kích thước vượt quá MAX_EDGE
        if (edge > MAX_EDGE) {
          const ratio = MAX_EDGE / edge;
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) { 
          reject(new Error('Trình duyệt không hỗ trợ canvas.')); 
          return; 
        }
        
        // Vẽ lại ảnh trên nền trắng (để tránh lỗi nền đen với ảnh PNG trong suốt)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        // Xuất ra định dạng base64 JPEG
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}