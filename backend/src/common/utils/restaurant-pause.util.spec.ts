import {
  computePauseUntil,
  formatPauseRemaining,
} from './restaurant-pause.util';

describe('restaurant-pause.util', () => {
  const baseTime = new Date('2026-11-03T10:00:00+07:00'); // 03:00 UTC, 10:00 VN

  it('tính đúng mốc hẹn giờ 30 phút, 1 giờ, 2 giờ', () => {
    const p30 = computePauseUntil('30m', baseTime);
    expect(p30.getTime() - baseTime.getTime()).toBe(30 * 60 * 1000);

    const p1h = computePauseUntil('1h', baseTime);
    expect(p1h.getTime() - baseTime.getTime()).toBe(60 * 60 * 1000);

    const p2h = computePauseUntil('2h', baseTime);
    expect(p2h.getTime() - baseTime.getTime()).toBe(120 * 60 * 1000);

    const custom = computePauseUntil(45, baseTime);
    expect(custom.getTime() - baseTime.getTime()).toBe(45 * 60 * 1000);
  });

  it('tính đúng mốc đến hết hôm nay theo giờ Việt Nam (UTC+7)', () => {
    const today = computePauseUntil('today', baseTime);
    // Phải là cuối ngày 2026-11-03 tại VN: 23:59:59.999 VN = 16:59:59.999 UTC
    expect(today.toISOString()).toContain('2026-11-03T16:59:59');
  });

  it('định dạng thời gian còn lại chuẩn xác', () => {
    // Tạm nghỉ 25 phút
    const target25m = new Date(baseTime.getTime() + 25 * 60 * 1000);
    const res25 = formatPauseRemaining(target25m, baseTime);
    expect(res25.isPaused).toBe(true);
    expect(res25.remainingMinutes).toBe(25);
    expect(res25.reopenTimeHhmm).toBe('10:25');
    expect(res25.label).toContain('25 phút');

    // Tạm nghỉ 90 phút (1h 30p)
    const target90m = new Date(baseTime.getTime() + 90 * 60 * 1000);
    const res90 = formatPauseRemaining(target90m, baseTime);
    expect(res90.isPaused).toBe(true);
    expect(res90.remainingMinutes).toBe(90);
    expect(res90.reopenTimeHhmm).toBe('11:30');
    expect(res90.label).toContain('1h 30p');

    // Đã hết hạn tạm nghỉ
    const past = new Date(baseTime.getTime() - 1000);
    const resPast = formatPauseRemaining(past, baseTime);
    expect(resPast.isPaused).toBe(false);
    expect(resPast.remainingMinutes).toBe(0);

    // Không có mốc tạm nghỉ
    expect(formatPauseRemaining(null, baseTime).isPaused).toBe(false);
  });
});
