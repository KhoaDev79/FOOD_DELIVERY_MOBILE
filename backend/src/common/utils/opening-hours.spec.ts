import { isAcceptingOrders, isWithinOpeningHours } from './opening-hours';

/** Thời điểm theo giờ VN, ví dụ vn('21:59') */
const vn = (hhmm: string) => new Date(`2026-10-30T${hhmm}:00+07:00`);

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

  it('chỉ nhận đơn khi chủ quán bật mở cửa và đang trong giờ', () => {
    const r = { isOpen: true, openTime: '07:00', closeTime: '22:00' };
    expect(isAcceptingOrders(r, vn('10:00'))).toBe(true);
    expect(isAcceptingOrders(r, vn('23:00'))).toBe(false);
    expect(isAcceptingOrders({ ...r, isOpen: false }, vn('10:00'))).toBe(false);
  });
});
