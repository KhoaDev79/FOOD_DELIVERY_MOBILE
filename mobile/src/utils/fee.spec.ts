import { calculateDistance, estimateDeliveryTime, isFreeDelivery } from './fee';

describe('Delivery Estimation & Freeship Rules', () => {
  test('Hai quán ở khoảng cách khác nhau phải cho thời gian ước tính khác nhau', () => {
    const nearEst = estimateDeliveryTime(1.2);
    const farEst = estimateDeliveryTime(6.5);
    const veryFarEst = estimateDeliveryTime(12);

    expect(nearEst).toBe('15 - 20 phút');
    expect(farEst).toBe('35 - 45 phút');
    expect(veryFarEst).toContain('51 - 68 phút');

    expect(nearEst).not.toBe(farEst);
    expect(farEst).not.toBe(veryFarEst);
  });

  test('Nhãn Freeship không hiện khi không có cờ khuyến mãi và phí giao > 0', () => {
    expect(isFreeDelivery(2)).toBe(false);
    expect(isFreeDelivery(2, { estimatedDeliveryFee: 15000 })).toBe(false);
    expect(isFreeDelivery(10, { estimatedDeliveryFee: 55000 })).toBe(false);
  });

  test('Freeship chỉ bật khi phí giao server trả = 0 hoặc có cờ hasFreeShipPromo', () => {
    expect(isFreeDelivery(5, { hasFreeShipPromo: true })).toBe(true);
    expect(isFreeDelivery(2, { freeShipThresholdKm: 3 })).toBe(true);
    expect(isFreeDelivery(4, { freeShipThresholdKm: 3 })).toBe(false);
    expect(isFreeDelivery(1, { estimatedDeliveryFee: 0 })).toBe(true);
  });

  test('Tính khoảng cách Haversine hợp lý', () => {
    const d = calculateDistance(10.7769, 106.7009, 10.785, 106.71);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(3);
  });
});
