import {
  getDishAvailabilityStatus,
  isDishWithinServingHours,
} from './dishAvailability';

const vn = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00+07:00`);

describe('dishAvailability (Mobile)', () => {
  it('kiểm tra khung giờ trong ngày (06:00 - 10:00)', () => {
    expect(isDishWithinServingHours('06:00', '10:00', vn('05:59'))).toBe(false);
    expect(isDishWithinServingHours('06:00', '10:00', vn('06:00'))).toBe(true);
    expect(isDishWithinServingHours('06:00', '10:00', vn('09:30'))).toBe(true);
    expect(isDishWithinServingHours('06:00', '10:00', vn('10:00'))).toBe(false);
  });

  it('kiểm tra khung giờ qua đêm (18:00 - 02:00)', () => {
    expect(isDishWithinServingHours('18:00', '02:00', vn('17:59'))).toBe(false);
    expect(isDishWithinServingHours('18:00', '02:00', vn('18:00'))).toBe(true);
    expect(isDishWithinServingHours('18:00', '02:00', vn('01:00'))).toBe(true);
    expect(isDishWithinServingHours('18:00', '02:00', vn('02:00'))).toBe(false);
  });

  it('lấy nhãn và trạng thái sẵn sàng của món', () => {
    // Món không giới hạn giờ
    const standard = getDishAvailabilityStatus({ isAvailable: true }, vn('12:00'));
    expect(standard.isAvailableNow).toBe(true);
    expect(standard.isTimedDish).toBe(false);
    expect(standard.tag).toBeNull();

    // Món trong giờ bán
    const active = getDishAvailabilityStatus(
      { isAvailable: true, availableFrom: '06:00', availableTo: '10:00' },
      vn('07:00'),
    );
    expect(active.isAvailableNow).toBe(true);
    expect(active.tag).toBe('Bán 06:00–10:00');

    // Món ngoài giờ bán
    const outside = getDishAvailabilityStatus(
      { isAvailable: true, availableFrom: '06:00', availableTo: '10:00' },
      vn('14:00'),
    );
    expect(outside.isAvailableNow).toBe(false);
    expect(outside.tag).toBe('Bán từ 06:00');
  });
});

