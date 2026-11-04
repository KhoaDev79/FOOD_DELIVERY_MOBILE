import {
  formatDuration,
  getStoreStatus,
  getTodayOpeningHour,
  getTodaySpecialClosing,
  isRestaurantPaused,
  isWithinOpeningHours,
} from './openingHours';

const vn = (hhmm: string, dateStr = '2026-11-03') => new Date(`${dateStr}T${hhmm}:00+07:00`);

describe('openingHours (Mobile)', () => {
  it('kiểm tra trong giờ mở cửa', () => {
    expect(isWithinOpeningHours('07:00', '22:00', vn('06:59'))).toBe(false);
    expect(isWithinOpeningHours('07:00', '22:00', vn('07:00'))).toBe(true);
    expect(isWithinOpeningHours('07:00', '22:00', vn('21:59'))).toBe(true);
    expect(isWithinOpeningHours('07:00', '22:00', vn('22:00'))).toBe(false);
  });

  it('kiểm tra formatDuration', () => {
    expect(formatDuration(45)).toBe('45 phút');
    expect(formatDuration(60)).toBe('1 giờ');
    expect(formatDuration(90)).toBe('1 giờ 30 phút');
  });

  it('nhận biết quán tạm nghỉ có hẹn giờ (pausedUntil)', () => {
    const now = vn('10:00');
    const future = vn('10:30').toISOString();
    const past = vn('09:30').toISOString();

    expect(isRestaurantPaused(future, now)).toBe(true);
    expect(isRestaurantPaused(past, now)).toBe(false);
    expect(isRestaurantPaused(null, now)).toBe(false);

    const pausedStore = {
      status: 'ACTIVE',
      isOpen: true,
      openTime: '07:00',
      closeTime: '22:00',
      pausedUntil: future,
    };

    const status = getStoreStatus(pausedStore, now);
    expect(status.kind).toBe('PAUSED');
    expect(status.accepting).toBe(false);
    expect(status.isTimedPause).toBe(true);
    expect(status.remainingMinutes).toBe(30);
    expect(status.reopenTime).toBe('10:30');
    expect(status.label).toBe('Tạm nghỉ có hẹn giờ');
    expect(status.detail).toContain('Tự mở lại lúc 10:30');

    // Khi đã hết giờ tạm nghỉ (mốc trong quá khứ)
    const expiredStore = { ...pausedStore, pausedUntil: past };
    const expiredStatus = getStoreStatus(expiredStore, now);
    expect(expiredStatus.kind).toBe('OPEN');
    expect(expiredStatus.accepting).toBe(true);
  });

  it('nhận biết ngày nghỉ đặc biệt trong getStoreStatus', () => {
    // 2026-11-03
    const storeWithClosing = {
      status: 'ACTIVE',
      isOpen: true,
      openTime: '07:00',
      closeTime: '22:00',
      specialClosings: [
        { id: 'sc-1', restaurantId: 'res-1', date: '2026-11-03', reason: 'Nghỉ bảo trì' },
      ],
    };

    const status = getStoreStatus(storeWithClosing, vn('10:00'));
    expect(status.kind).toBe('PAUSED');
    expect(status.accepting).toBe(false);
    expect(status.label).toBe('Nghỉ ngày đặc biệt');
    expect(status.detail).toContain('Nghỉ bảo trì');

    const closingItem = getTodaySpecialClosing(storeWithClosing.specialClosings, vn('10:00'));
    expect(closingItem?.reason).toBe('Nghỉ bảo trì');
  });

  it('nhận diện giờ mở theo ngày trong tuần getTodayOpeningHour', () => {
    // 2026-11-03 là Thứ Ba (dayOfWeek = 2)
    const openingHours = [
      { id: '1', restaurantId: 'res-1', dayOfWeek: 2, openTime: '08:30', closeTime: '21:30', isClosed: false },
      { id: '2', restaurantId: 'res-1', dayOfWeek: 3, openTime: '10:00', closeTime: '22:00', isClosed: true },
    ];

    const todayH = getTodayOpeningHour(openingHours, '07:00', '22:00', vn('10:00', '2026-11-03'));
    expect(todayH.openTime).toBe('08:30');
    expect(todayH.closeTime).toBe('21:30');
    expect(todayH.isClosed).toBe(false);

    // Ngày hôm sau là Thứ Tư (dayOfWeek = 3) -> isClosed
    const wedH = getTodayOpeningHour(openingHours, '07:00', '22:00', vn('10:00', '2026-11-04'));
    expect(wedH.isClosed).toBe(true);
  });
});
