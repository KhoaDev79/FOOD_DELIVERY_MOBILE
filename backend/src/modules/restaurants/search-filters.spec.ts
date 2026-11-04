import { calcDeliveryFee } from '../../common/utils/geo.util';
import { maxDistanceForFee, promoLabelFor } from './search-filters';

describe('search-filters', () => {
  // Cùng cách tính với phí ship ước tính trên thẻ quán (đường bộ ≈ 1,3 × đường chim bay), ngoài giờ cao điểm
  const feeAt = (km: number) =>
    calcDeliveryFee(km * 1.3, { baseFee: 15000, feePerKm: 5000, freeKm: 2, peakMultiplier: 1, peakWindows: [] } as never);

  it('phí ship tối đa 15.000 ₫ = trong phạm vi 2 km đường bộ đầu tiên', () => {
    const km = maxDistanceForFee(15000, feeAt);
    expect(feeAt(km)).toBeLessThanOrEqual(15000);
    expect(feeAt(km + 0.05)).toBeGreaterThan(15000);
  });

  it('phí càng cao thì khoảng cách cho phép càng xa', () => {
    expect(maxDistanceForFee(25000, feeAt)).toBeGreaterThan(maxDistanceForFee(15000, feeAt));
  });

  it('mức phí thấp hơn phí tối thiểu: không quán nào thoả', () => {
    expect(maxDistanceForFee(5000, feeAt)).toBe(-1);
  });

  it('nhãn ưu đãi: ưu tiên mã giảm nhiều nhất', () => {
    expect(
      promoLabelFor(
        [
          { discountType: 'FREE_SHIP', discountValue: 0, maxDiscountAmount: null },
          { discountType: 'FIXED_AMOUNT', discountValue: 15000, maxDiscountAmount: null },
          { discountType: 'PERCENTAGE', discountValue: 10, maxDiscountAmount: 30000 },
        ],
        false,
      ),
    ).toBe('Giảm 10%');
    expect(promoLabelFor([{ discountType: 'FIXED_AMOUNT', discountValue: 15000, maxDiscountAmount: null }], false)).toBe('Giảm 15K');
    expect(promoLabelFor([], true)).toBe('Món giảm giá');
    expect(promoLabelFor([], false)).toBeNull();
  });
});
