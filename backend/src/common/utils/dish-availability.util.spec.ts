import {
  getDishAvailability,
  isDishWithinServingHours,
} from './dish-availability.util';

const vn = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00+07:00`);

describe('dish-availability.util', () => {
  describe('isDishWithinServingHours', () => {
    it('món không đặt khung giờ thì luôn mở bán', () => {
      expect(isDishWithinServingHours(null, null, vn('03:00'))).toBe(true);
      expect(isDishWithinServingHours(undefined, undefined, vn('12:00'))).toBe(true);
    });

    it('món bán khung giờ trong ngày (06:00 - 10:30)', () => {
      const from = '06:00';
      const to = '10:30';

      expect(isDishWithinServingHours(from, to, vn('05:59'))).toBe(false);
      expect(isDishWithinServingHours(from, to, vn('06:00'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('09:15'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('10:29'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('10:30'))).toBe(false);
      expect(isDishWithinServingHours(from, to, vn('18:00'))).toBe(false);
    });

    it('món bán khung giờ qua đêm (18:00 - 02:00)', () => {
      const from = '18:00';
      const to = '02:00';

      expect(isDishWithinServingHours(from, to, vn('17:59'))).toBe(false);
      expect(isDishWithinServingHours(from, to, vn('18:00'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('23:59'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('01:59'))).toBe(true);
      expect(isDishWithinServingHours(from, to, vn('02:00'))).toBe(false);
      expect(isDishWithinServingHours(from, to, vn('12:00'))).toBe(false);
    });

    it('món bán cả ngày khi from === to', () => {
      expect(isDishWithinServingHours('00:00', '00:00', vn('15:00'))).toBe(true);
    });
  });

  describe('getDishAvailability', () => {
    it('món tạm hết (isAvailable = false)', () => {
      const res = getDishAvailability({ name: 'Phở bò', isAvailable: false }, vn('08:00'));
      expect(res.isAvailableNow).toBe(false);
      expect(res.notice).toBe('Tạm hết món');
    });

    it('món trong giờ mở bán', () => {
      const res = getDishAvailability(
        { name: 'Bánh mì', isAvailable: true, availableFrom: '06:00', availableTo: '10:00' },
        vn('07:30'),
      );
      expect(res.isAvailableNow).toBe(true);
      expect(res.notice).toBeNull();
      expect(res.servingTimeLabel).toBe('06:00 – 10:00');
    });

    it('món ngoài giờ mở bán', () => {
      const res = getDishAvailability(
        { name: 'Bánh mì', isAvailable: true, availableFrom: '06:00', availableTo: '10:00' },
        vn('14:00'),
      );
      expect(res.isAvailableNow).toBe(false);
      expect(res.notice).toBe('Bán từ 06:00');
      expect(res.servingTimeLabel).toBe('06:00 – 10:00');
    });
  });
});

