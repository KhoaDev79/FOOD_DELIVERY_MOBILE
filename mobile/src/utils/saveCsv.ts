import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const BOM = '﻿';

/**
 * Lưu nội dung CSV thành file rồi cho người dùng mở/gửi đi:
 * - Web: tải file về máy.
 * - Điện thoại: ghi vào bộ nhớ tạm rồi mở bảng chia sẻ (lưu vào Files/Drive, gửi Zalo, mở bằng Excel…).
 * Luôn giữ BOM UTF-8 để Excel hiển thị đúng tiếng Việt.
 */
export async function saveCsv(fileName: string, content: string): Promise<'downloaded' | 'shared'> {
  const text = content.startsWith(BOM) ? content : BOM + content;

  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Thiết bị không hỗ trợ chia sẻ file');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: fileName,
  });
  return 'shared';
}
