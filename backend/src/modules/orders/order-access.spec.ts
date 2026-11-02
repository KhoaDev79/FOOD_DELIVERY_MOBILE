import { isPhoneHidden, PHONE_VISIBLE_AFTER_FINISH_MS } from './order-access';

describe('isPhoneHidden', () => {
  const now = Date.now();
  const longAgo = new Date(now - PHONE_VISIBLE_AFTER_FINISH_MS - 60_000);
  const justNow = new Date(now - 60_000);

  it('ẩn số khi đơn đã kết thúc quá 2 giờ', () => {
    for (const status of ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED']) {
      expect(isPhoneHidden(status, longAgo, now)).toBe(true);
    }
  });

  it('vẫn hiện số khi đơn vừa kết thúc hoặc đang chạy', () => {
    expect(isPhoneHidden('DELIVERED', justNow, now)).toBe(false);
    expect(isPhoneHidden('PICKED_UP', longAgo, now)).toBe(false);
    expect(isPhoneHidden('PENDING', longAgo, now)).toBe(false);
  });
});
