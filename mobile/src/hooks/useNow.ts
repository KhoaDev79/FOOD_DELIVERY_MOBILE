import { useEffect, useState } from 'react';

/**
 * Thời điểm hiện tại, tự cập nhật theo chu kỳ (mặc định mỗi phút, khớp đầu phút).
 * Dùng cho những chỗ hiển thị phụ thuộc giờ: trạng thái mở/đóng cửa, "5 phút trước"…
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    // Chờ tới đầu phút kế tiếp rồi mới chạy đều, để giờ đổi đúng lúc (vd đúng 22:00)
    const align = setTimeout(() => {
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), intervalMs);
    }, intervalMs - (Date.now() % intervalMs));
    return () => {
      clearTimeout(align);
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
