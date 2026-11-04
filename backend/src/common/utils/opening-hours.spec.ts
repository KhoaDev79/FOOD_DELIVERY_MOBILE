import {
  isAcceptingOrders,
  isSpecialClosing,
  isWithinOpeningHours,
  isWithinWeeklySchedule,
} from './opening-hours';

/** Thời điểm theo giờ VN, ví dụ vn('21:59') - ngày 2026-10-30 là Thứ Sáu (dayOfWeek = 5) */
const vn = (hhmm: string, dateStr = '2026-10-30') => new Date(`${dateStr}T${hhmm}:00+07:00`);

describe('opening-hours', () => {
  it('quán mở trong ngày', () => {
    expect(isWithinOpeningHours('07:00', '22:00', vn('06:59'))).toBe(false);
    expect(isWithinOpeningHours('07:00', '22:00', vn('07:00'))).toBe(true);
    expect(isWithinOpeningHours('07:00', '22:00', vn('21:59'))).toBe(true);
    expect(isWithinOpeningHours('07:00', '22:00', vn('22:00'))).toBe(false);
  });

  it('quán mở qua đêm', () => {
    expect(isWithinOpeningHours('18:00', '02:00', vn('23:30'))).toBe(true);
    expect(isWithinOpeningHours('18:00', '02:00', vn('01:59'))).toBe(true);
    expect(isWithinOpeningHours('18:00', '02:00', vn('02:00'))).toBe(false);
    expect(isWithinOpeningHours('18:00', '02:00', vn('12:00'))).toBe(false);
  });

  it('giờ mở = giờ đóng nghĩa là mở cả ngày', () => {
    expect(isWithinOpeningHours('00:00', '00:00', vn('03:00'))).toBe(true);
  });

  it('chỉ nhận đơn khi status ACTIVE, chủ quán bật mở cửa và đang trong giờ', () => {
    const r = { status: 'ACTIVE' as const, isOpen: true, openTime: '07:00', closeTime: '22:00' };
    expect(isAcceptingOrders(r, vn('10:00'))).toBe(true);
    expect(isAcceptingOrders(r, vn('23:00'))).toBe(false);
    expect(isAcceptingOrders({ ...r, isOpen: false }, vn('10:00'))).toBe(false);
    expect(isAcceptingOrders({ ...r, status: 'PENDING_APPROVAL' }, vn('10:00'))).toBe(false);
    expect(isAcceptingOrders({ ...r, status: 'SUSPENDED' }, vn('10:00'))).toBe(false);
  });

  it('chặn nhận đơn khi quán đang tạm nghỉ có hẹn giờ (pausedUntil)', () => {
    const r = { status: 'ACTIVE' as const, isOpen: true, openTime: '07:00', closeTime: '22:00' };
    const now = vn('10:00');
    // Đang tạm nghỉ tới 10:30 -> không nhận đơn
    expect(isAcceptingOrders({ ...r, pausedUntil: vn('10:30') }, now)).toBe(false);

    // Đã hết giờ tạm nghỉ (mốc 09:30 trong quá khứ) -> nhận đơn bình thường
    expect(isAcceptingOrders({ ...r, pausedUntil: vn('09:30') }, now)).toBe(true);
  });

  describe('isSpecialClosing (Ngày nghỉ đặc biệt / lễ Tết)', () => {
    it('nhận diện đúng ngày nghỉ đặc biệt theo giờ Việt Nam', () => {
      const closings = [
        { date: '2026-10-30', reason: 'Nghỉ Tết Dương Lịch' },
        { date: '2026-12-25', reason: 'Nghỉ Giáng Sinh' },
      ];

      const resToday = isSpecialClosing(closings, vn('12:00', '2026-10-30'));
      expect(resToday.isClosing).toBe(true);
      expect(resToday.reason).toBe('Nghỉ Tết Dương Lịch');

      const resOtherDay = isSpecialClosing(closings, vn('12:00', '2026-10-31'));
      expect(resOtherDay.isClosing).toBe(false);
    });
  });

  describe('isWithinWeeklySchedule (Lịch mở cửa 7 ngày trong tuần)', () => {
    it('ưu tiên lịch của ngày hôm nay thay vì giờ mặc định', () => {
      // 2026-10-30 là Thứ Sáu (dayOfWeek = 5)
      const weeklyHours = [
        { dayOfWeek: 5, openTime: '11:00', closeTime: '14:00', isClosed: false }, // Thứ 6
        { dayOfWeek: 6, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Thứ 7
      ];
      const r = { openTime: '06:00', closeTime: '23:00', openingHours: weeklyHours };

      // Lúc 09:00 Thứ 6: nằm trong openTime mặc định (06:00-23:00) nhưng NGOÀI giờ Thứ 6 (11:00-14:00)
      expect(isWithinWeeklySchedule(r, vn('09:00', '2026-10-30'))).toBe(false);

      // Lúc 12:00 Thứ 6: nằm trong giờ Thứ 6 -> mở
      expect(isWithinWeeklySchedule(r, vn('12:00', '2026-10-30'))).toBe(true);
    });

    it('đóng cửa nếu ngày hôm nay được đánh dấu isClosed', () => {
      const weeklyHours = [
        { dayOfWeek: 5, openTime: '08:00', closeTime: '22:00', isClosed: true },
      ];
      const r = { openTime: '08:00', closeTime: '22:00', openingHours: weeklyHours };

      expect(isWithinWeeklySchedule(r, vn('10:00', '2026-10-30'))).toBe(false);
    });

    it('tương thích ngược nếu chưa cấu hình ngày hôm nay', () => {
      const weeklyHours = [
        { dayOfWeek: 1, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Chỉ cấu hình Thứ Hai
      ];
      const r = { openTime: '07:00', closeTime: '21:00', openingHours: weeklyHours };

      // Thứ Sáu (5) chưa cấu hình -> dùng mặc định (07:00-21:00)
      expect(isWithinWeeklySchedule(r, vn('10:00', '2026-10-30'))).toBe(true);
      expect(isWithinWeeklySchedule(r, vn('22:00', '2026-10-30'))).toBe(false);
    });
  });
});
