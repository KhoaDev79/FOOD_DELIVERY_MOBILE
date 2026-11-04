/**
 * Hỗ trợ các mốc hẹn giờ tạm nghỉ của quán ăn.
 * Hết thời gian hẹn, quán tự động mở lại theo giờ hoạt động bình thường.
 */

const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

export type PausePresetMode = '30m' | '1h' | '2h' | 'today';

/**
 * Tính toán thời điểm `pausedUntil` dựa vào chế độ chọn.
 */
export function computePauseUntil(
  mode: PausePresetMode | number,
  now: Date = new Date(),
): Date {
  if (typeof mode === 'number') {
    return new Date(now.getTime() + Math.max(1, mode) * 60_000);
  }

  switch (mode) {
    case '30m':
      return new Date(now.getTime() + 30 * 60_000);
    case '1h':
      return new Date(now.getTime() + 60 * 60_000);
    case '2h':
      return new Date(now.getTime() + 120 * 60_000);
    case 'today': {
      // Hết ngày hôm nay theo múi giờ Việt Nam (23:59:59.999 UTC+7)
      const vnTime = new Date(now.getTime() + VN_OFFSET_MS);
      const year = vnTime.getUTCFullYear();
      const month = vnTime.getUTCMonth();
      const date = vnTime.getUTCDate();
      // 23:59:59.999 VN = (23-7):59:59.999 UTC = 16:59:59.999 UTC
      const endOfDayUtc = Date.UTC(year, month, date, 23 - VN_OFFSET_HOURS, 59, 59, 999);
      return new Date(endOfDayUtc);
    }
    default:
      return new Date(now.getTime() + 30 * 60_000);
  }
}

/**
 * Định dạng số phút còn lại và nhãn thân thiện.
 */
export function formatPauseRemaining(
  pausedUntil: Date | string | null | undefined,
  now: Date = new Date(),
): { isPaused: boolean; remainingMinutes: number; reopenTimeHhmm: string; label: string } {
  if (!pausedUntil) {
    return { isPaused: false, remainingMinutes: 0, reopenTimeHhmm: '', label: '' };
  }
  const target = typeof pausedUntil === 'string' ? new Date(pausedUntil) : pausedUntil;
  const diffMs = target.getTime() - now.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return { isPaused: false, remainingMinutes: 0, reopenTimeHhmm: '', label: '' };
  }

  const remainingMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  const vnTarget = new Date(target.getTime() + VN_OFFSET_MS);
  const hh = String(vnTarget.getUTCHours()).padStart(2, '0');
  const mm = String(vnTarget.getUTCMinutes()).padStart(2, '0');
  const reopenTimeHhmm = `${hh}:${mm}`;

  let label: string;
  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    label =
      mins > 0
        ? `Tự mở lại lúc ${reopenTimeHhmm} (sau ${hours}h ${mins}p)`
        : `Tự mở lại lúc ${reopenTimeHhmm} (sau ${hours}h)`;
  } else {
    label = `Tự mở lại lúc ${reopenTimeHhmm} (sau ${remainingMinutes} phút)`;
  }

  return {
    isPaused: true,
    remainingMinutes,
    reopenTimeHhmm,
    label,
  };
}

