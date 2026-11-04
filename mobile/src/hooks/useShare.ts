import { useCallback } from 'react';
import { Platform, Share } from 'react-native';
import { useToast } from '../components/ui';

/**
 * Mở bảng chia sẻ của hệ thống (Zalo, Messenger, sao chép…). Trên trình duyệt không hỗ trợ
 * Web Share thì sao chép link vào bộ nhớ tạm và báo cho người dùng.
 */
export function useShare() {
  const toast = useToast();
  return useCallback(
    async ({ title, message, url }: { title: string; message: string; url: string }) => {
      try {
        if (Platform.OS === 'web') {
          const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
          if (nav?.share) {
            await nav.share({ title, text: message.replace(url, '').trim(), url });
            return;
          }
          if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(message);
            toast('Đã sao chép link chia sẻ', 'success');
            return;
          }
        }
        // iOS hiển thị `url` thành thẻ riêng; Android chỉ đọc `message` nên link đã nằm sẵn trong message
        await Share.share(
          Platform.OS === 'ios' ? { title, message: message.replace(url, '').trim(), url } : { title, message },
          { dialogTitle: title },
        );
      } catch (err: any) {
        // Người dùng tự đóng bảng chia sẻ trên web → AbortError, không phải lỗi
        if (err?.name === 'AbortError') return;
        toast('Không mở được bảng chia sẻ', 'error');
      }
    },
    [toast],
  );
}
