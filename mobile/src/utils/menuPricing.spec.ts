import {
  discountPercent,
  discountPriceFor,
  effectiveBasePrice,
  hasChoices,
  linePrice,
  originalLinePrice,
} from './menuPricing';

const options = {
  sizes: [
    { id: 'M', name: 'Size M', price: 0 },
    { id: 'L', name: 'Size L', price: 8000 },
  ],
  toppings: [
    { id: 'tc', name: 'Trân châu', price: 6000 },
    { id: 'kem', name: 'Kem cheese', price: 10000 },
  ],
  sugarLevels: ['50%', '100%'],
};
const trasua = { price: 40000, discountPrice: 32000, options };

describe('menuPricing (khớp quy tắc backend)', () => {
  it('giá cơ sở dùng giá giảm hợp lệ', () => {
    expect(effectiveBasePrice(trasua)).toBe(32000);
    expect(effectiveBasePrice({ price: 40000, discountPrice: 40000 })).toBe(40000);
    expect(effectiveBasePrice({ price: 40000, discountPrice: 0 })).toBe(40000);
  });

  it('phần trăm giảm', () => {
    expect(discountPercent(trasua)).toBe(20);
    expect(discountPercent({ price: 40000 })).toBe(0);
  });

  it('đơn giá = giá giảm + size + topping; không chọn size thì size đầu', () => {
    expect(linePrice(trasua)).toBe(32000);
    expect(linePrice(trasua, { sizeId: 'L', toppingIds: ['tc', 'kem'] })).toBe(32000 + 8000 + 6000 + 10000);
  });

  it('giá gốc để gạch ngang không áp giảm', () => {
    expect(originalLinePrice(trasua, { sizeId: 'L' })).toBe(48000);
  });

  it('nhận biết món có tuỳ chọn', () => {
    expect(hasChoices(trasua)).toBe(true);
    expect(hasChoices({ options: null })).toBe(false);
    expect(hasChoices({ options: { sizes: [] } as never })).toBe(false);
  });
});

describe('discountPriceFor', () => {
  it('khớp công thức backend và suy ngược ra đúng phần trăm', () => {
    expect(discountPriceFor(55000, 7)).toBe(51200);
    expect(discountPriceFor(250000, 20)).toBe(200000);
    expect(discountPriceFor(55000, 0)).toBeNull();
    for (const p of [5, 7, 10, 15, 20]) {
      expect(discountPercent({ price: 55000, discountPrice: discountPriceFor(55000, p) })).toBe(p);
    }
  });
});
