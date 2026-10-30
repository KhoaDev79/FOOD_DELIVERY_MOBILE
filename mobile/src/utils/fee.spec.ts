import { calculateDeliveryFee, estimateDeliveryTime, isFreeDelivery } from './fee';

describe('Delivery Estimation & Freeship Rules (Item 3)', () => {
  test('Hai quán ở khoảng cách khác nhau phải cho thời gian ước tính khác nhau', () => {
    // Quán gần 1.2km
    const nearEst = estimateDeliveryTime(1.2);
    // Quán xa 6.5km
    const farEst = estimateDeliveryTime(6.5);
    // Quán rất xa 12km
    const veryFarEst = estimateDeliveryTime(12);

    expect(nearEst).toBe('15 - 20 phút');
    expect(farEst).toBe('35 - 45 phút');
    expect(veryFarEst).toContain('51 - 68 phút');

    // Chứng minh hai quán ở khoảng cách khác nhau cho thời gian khác nhau
    expect(nearEst).not.toBe(farEst);
    expect(farEst).not.toBe(veryFarEst);
  });

  test('Nhãn Freeship TUYỆT ĐỐI KHÔNG hiện khi phí giao hàng khác 0', () => {
    // Khoảng cách 2km: phí cơ bản 15.000đ (18.000đ giờ cao điểm)
    const fee2km = calculateDeliveryFee(2);
    expect(fee2km.fee).toBeGreaterThan(0);

    // Vì phí > 0 và không có chương trình khuyến mãi, Freeship PHẢI là false
    const isFreeship2km = isFreeDelivery(2);
    expect(isFreeship2km).toBe(false);

    // Khoảng cách 10km: Phí lớn hơn 0
    const fee10km = calculateDeliveryFee(10);
    expect(fee10km.fee).toBeGreaterThan(0);
    expect(isFreeDelivery(10)).toBe(false);
  });

  test('Freeship chỉ bật khi phí giao = 0 hoặc có cờ hasFreeShipPromo', () => {
    // Trường hợp có promo Freeship từ nhà hàng
    expect(isFreeDelivery(5, { hasFreeShipPromo: true })).toBe(true);

    // Trường hợp nằm trong bán kính miễn phí giao của quán (ví dụ dưới 3km)
    expect(isFreeDelivery(2, { freeShipThresholdKm: 3 })).toBe(true);
    expect(isFreeDelivery(4, { freeShipThresholdKm: 3 })).toBe(false);
  });
});

describe('Phí giao hàng khớp công thức backend', () => {
  // 09:00 và 12:00 giờ Việt Nam (UTC+7) => 02:00Z và 05:00Z
  const offPeak = new Date('2026-10-30T02:00:00Z');
  const peak = new Date('2026-10-30T05:00:00Z');

  test('trong 2 km đầu chỉ tính phí cơ bản 15.000đ', () => {
    expect(calculateDeliveryFee(0.17, offPeak).fee).toBe(15000);
    expect(calculateDeliveryFee(2, offPeak).fee).toBe(15000);
  });

  test('sau 2 km cộng 5.000đ/km, làm tròn lên 1.000đ', () => {
    expect(calculateDeliveryFee(5, offPeak).fee).toBe(30000);
    expect(calculateDeliveryFee(2.3, offPeak).fee).toBe(17000); // 15.000 + 1.500 -> 17.000
  });

  test('giờ cao điểm nhân 1,2', () => {
    const r = calculateDeliveryFee(5, peak);
    expect(r.isPeak).toBe(true);
    expect(r.fee).toBe(36000);
  });
});
