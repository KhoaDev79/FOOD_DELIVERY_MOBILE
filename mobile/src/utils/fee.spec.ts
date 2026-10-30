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
    // Khoảng cách 2km: Phí giao hàng là 10.000đ (hoặc 20.000đ nếu giờ cao điểm)
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

