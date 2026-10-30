import { API_BASE_URL } from '../constants/config';

/**
 * Hàm giải quyết đường dẫn ảnh:
 * - Nếu là đường dẫn tương đối (ví dụ /public/images/food/pho.jpg hoặc public/images/food/pho.jpg),
 *   tự động ghép với Base URL của Backend từ cấu hình động (hỗ trợ đổi IP mạng không bị mất ảnh).
 * - Nếu là URL tuyệt đối (http:// hoặc https://), giữ nguyên.
 * - Nếu null, undefined hoặc chuỗi rỗng: trả về null để kích hoạt ảnh dự phòng.
 */
export function resolveImageUrl(uri?: string | null): string | null {
  if (!uri || typeof uri !== 'string' || !uri.trim()) return null;
  const trimmed = uri.trim();

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Lấy gốc server backend (bỏ đuôi /api/v1)
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendOrigin}${relativePath}`;
}

/**
 * Lấy chữ cái viết hoa đầu tiên của tiêu đề quán/món để hiển thị trên ảnh dự phòng
 */
export function getFallbackInitial(title?: string): string {
  if (!title || !title.trim()) return 'F';
  return title.trim().charAt(0).toUpperCase();
}

