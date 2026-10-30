import { discountPercentOf, discountPriceFor } from './menu-discount';

describe('menu-discount', () => {
  it('tính giá sau giảm, làm tròn tới 100 ₫', () => {
    expect(discountPriceFor(55_000, 7)).toBe(51_200); // 51.150 -> 51.200
    expect(discountPriceFor(250_000, 20)).toBe(200_000);
    expect(discountPriceFor(35_000, 5)).toBe(33_300); // 33.250 -> 33.300
  });

  it('không giảm thì trả null', () => {
    expect(discountPriceFor(55_000, 0)).toBeNull();
  });

  it('suy ra lại đúng phần trăm từ giá đã lưu', () => {
    for (const p of [5, 7, 10, 15, 20]) {
      expect(discountPercentOf(55_000, discountPriceFor(55_000, p))).toBe(p);
    }
    expect(discountPercentOf(55_000, null)).toBe(0);
    expect(discountPercentOf(55_000, 60_000)).toBe(0);
  });
});
