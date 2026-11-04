/** Phân loại nhóm ngày theo mốc thời gian */
export function getDateCategory(dateInput: string | Date, nowInput?: Date): 'Hôm nay' | 'Hôm qua' | 'Tuần này' | 'Cũ hơn' {
  const date = new Date(dateInput);
  const now = nowInput ?? new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (date >= startOfToday) return 'Hôm nay';
  if (date >= startOfYesterday) return 'Hôm qua';
  if (date >= startOfWeek) return 'Tuần này';
  return 'Cũ hơn';
}

/** Định dạng thời gian hiển thị thân thiện */
export function formatNotificationTime(dateInput: string | Date, nowInput?: Date): string {
  const date = new Date(dateInput);
  const now = nowInput ?? new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (60 * 1000));

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) return `${hours}:${minutes}`;

  return `${hours}:${minutes} - ${day}/${month}`;
}

