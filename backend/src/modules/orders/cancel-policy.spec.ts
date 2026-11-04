import { evaluateCancelLimit } from './cancel-policy';

const NOW = new Date('2026-11-04T05:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('evaluateCancelLimit', () => {
  it('chưa huỷ đơn nào: không nhắc, không hạn chế', () => {
    expect(evaluateCancelLimit([], NOW)).toEqual({ count: 0, limit: 4, windowDays: 7, restricted: false });
  });

  it('đã huỷ 1 đơn: lần huỷ tiếp theo (thứ 2) bắt đầu được nhắc', () => {
    const r = evaluateCancelLimit([hoursAgo(5)], NOW);
    expect(r.restricted).toBe(false);
    expect(r.warning).toContain('Bạn đã huỷ 1 đơn trong 7 ngày');
  });

  it('đã huỷ 3 đơn: nhắc lần huỷ thứ 4 sẽ bị hạn chế', () => {
    const r = evaluateCancelLimit([hoursAgo(1), hoursAgo(2), hoursAgo(3)], NOW);
    expect(r.restricted).toBe(false);
    expect(r.warning).toContain('lần huỷ thứ 4');
  });

  it('đạt 4 lần trong 7 ngày: hạn chế tới khi lần huỷ cũ nhất rời khoảng', () => {
    const times = [hoursAgo(24 * 6), hoursAgo(10), hoursAgo(5), hoursAgo(1)];
    const r = evaluateCancelLimit(times, NOW);
    expect(r.restricted).toBe(true);
    // Lần cũ nhất cách đây 6 ngày -> còn 1 ngày nữa mới hết hạn chế
    expect(r.restrictedUntil!.getTime()).toBe(times[0].getTime() + 7 * 86_400_000);
  });

  it('5 lần: phải chờ lần thứ 2 tính từ cũ nhất rời khoảng', () => {
    const times = [hoursAgo(24 * 6.5), hoursAgo(24 * 3), hoursAgo(10), hoursAgo(5), hoursAgo(1)];
    const r = evaluateCancelLimit(times, NOW);
    expect(r.restrictedUntil!.getTime()).toBe(times[1].getTime() + 7 * 86_400_000);
  });

  it('lần huỷ quá 7 ngày không tính', () => {
    const r = evaluateCancelLimit([hoursAgo(24 * 8), hoursAgo(24 * 9), hoursAgo(24 * 10), hoursAgo(24 * 11)], NOW);
    expect(r.count).toBe(0);
    expect(r.restricted).toBe(false);
  });
});
