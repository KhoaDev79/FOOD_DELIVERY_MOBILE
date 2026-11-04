/** Khoảng ngày chọn nhanh khi xuất CSV. Ngày theo lịch của máy (người dùng ở VN). */
export type ExportPreset = '7d' | '30d' | 'thisMonth' | 'lastMonth';

export const EXPORT_PRESETS: { key: ExportPreset; label: string }[] = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD theo giờ máy (không dùng toISOString vì đổi sang UTC sẽ lệch ngày). */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** dd/mm/yyyy để hiển thị. */
export const dmy = (key: string) => key.split('-').reverse().join('/');

export function presetRange(preset: ExportPreset, now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case '7d':
      return { from: ymd(new Date(y, m, now.getDate() - 6)), to: ymd(now) };
    case '30d':
      return { from: ymd(new Date(y, m, now.getDate() - 29)), to: ymd(now) };
    case 'thisMonth':
      return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
    case 'lastMonth':
      // Ngày 0 của tháng này = ngày cuối tháng trước
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  }
}

/** Tên file giống backend: zomzom-don-hang_2026-10-01_2026-10-31.csv */
export const exportFileName = (prefix: string, from: string, to: string) => `${prefix}_${from}_${to}.csv`;
