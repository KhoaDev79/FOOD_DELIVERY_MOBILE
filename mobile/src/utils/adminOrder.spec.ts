import { describeHistoryActor, formatDuration, minutesBetween, relativeTime, stepHealth } from './adminOrder';

describe('describeHistoryActor', () => {
  it('hiện vai trò + tên, chủ quán hiện theo tên quán', () => {
    expect(describeHistoryActor(null)).toBe('Hệ thống tự động');
    expect(describeHistoryActor({ id: '1', fullName: 'Ryan', role: 'DRIVER' })).toBe('Tài xế Ryan');
    expect(describeHistoryActor({ id: '2', fullName: 'Khoa', role: 'ADMIN' })).toBe('Admin Khoa');
    expect(describeHistoryActor({ id: '3', fullName: 'Lan', role: 'CUSTOMER' })).toBe('Khách Lan');
    expect(describeHistoryActor({ id: '4', fullName: 'Bình', role: 'RESTAURANT_OWNER' }, 'ZomZom')).toBe('Quán ZomZom');
    expect(describeHistoryActor({ id: '4', fullName: 'Bình', role: 'RESTAURANT_OWNER' })).toBe('Chủ quán Bình');
  });
});

describe('stepHealth', () => {
  it('so với thời gian chuẩn của bước', () => {
    expect(stepHealth('READY_FOR_PICKUP', 5)).toBe('ok');
    expect(stepHealth('READY_FOR_PICKUP', 15)).toBe('slow');
    expect(stepHealth('READY_FOR_PICKUP', 25)).toBe('late');
    expect(stepHealth('DELIVERED', 999)).toBe('ok');
  });
});

describe('minutesBetween / formatDuration', () => {
  it('tính phút và định dạng', () => {
    expect(minutesBetween('2026-11-02T10:00:00Z', '2026-11-02T10:12:30Z')).toBe(12);
    expect(minutesBetween('2026-11-02T10:00:00Z', '2026-11-02T09:00:00Z')).toBe(0);
    expect(formatDuration(12)).toBe('12 phút');
    expect(formatDuration(65)).toBe('1 giờ 5 phút');
    expect(formatDuration(120)).toBe('2 giờ');
    expect(formatDuration(96 * 60 + 38)).toBe('hơn 4 ngày');
    expect(formatDuration(48 * 60)).toBe('2 ngày');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('mốc thời gian tương đối', () => {
    expect(relativeTime('2026-11-03T09:59:40Z', now)).toBe('Vừa xong');
    expect(relativeTime('2026-11-03T09:55:00Z', now)).toBe('5 phút trước');
    expect(relativeTime('2026-11-03T07:00:00Z', now)).toBe('3 giờ trước');
    expect(relativeTime('2026-11-01T09:00:00Z', now)).toBe('2 ngày trước');
  });
});
