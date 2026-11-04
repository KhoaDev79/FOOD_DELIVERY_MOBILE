import { formatNotificationTime, getDateCategory } from './notificationFormat';

describe('notificationFormat', () => {
  const fixedNow = new Date('2026-11-03T16:00:00.000Z');

  describe('getDateCategory', () => {
    it('trả về "Hôm nay" nếu trong ngày hiện tại', () => {
      const today = new Date('2026-11-03T10:00:00.000Z');
      expect(getDateCategory(today, fixedNow)).toBe('Hôm nay');
    });

    it('trả về "Hôm qua" nếu trong ngày hôm trước', () => {
      const yesterday = new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000);
      expect(getDateCategory(yesterday, fixedNow)).toBe('Hôm qua');
    });

    it('trả về "Tuần này" nếu trong vòng 7 ngày', () => {
      const threeDaysAgo = new Date(fixedNow.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(getDateCategory(threeDaysAgo, fixedNow)).toBe('Tuần này');
    });

    it('trả về "Cũ hơn" nếu quá 7 ngày', () => {
      const old = new Date(fixedNow.getTime() - 10 * 24 * 60 * 60 * 1000);
      expect(getDateCategory(old, fixedNow)).toBe('Cũ hơn');
    });
  });

  describe('formatNotificationTime', () => {
    it('trả về "Vừa xong" nếu cách dưới 1 phút', () => {
      const justNow = new Date(fixedNow.getTime() - 30 * 1000);
      expect(formatNotificationTime(justNow, fixedNow)).toBe('Vừa xong');
    });

    it('trả về "X phút trước" nếu cách dưới 60 phút', () => {
      const twentyMinsAgo = new Date(fixedNow.getTime() - 20 * 60 * 1000);
      expect(formatNotificationTime(twentyMinsAgo, fixedNow)).toBe('20 phút trước');
    });
  });
});

