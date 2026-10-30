import { effectiveBasePrice, lineKey, OrderPricingError, priceOrderLine } from './order-pricing';

const noodleOptions = {
  sizes: [
    { id: 'to_thuong', name: 'Tô Thường', price: 0 },
    { id: 'to_dac_biet', name: 'Tô Đặc Biệt', price: 15000 },
  ],
  toppings: [
    { id: 'quay', name: 'Quẩy', price: 8000 },
    { id: 'trung', name: 'Trứng chần', price: 7000 },
  ],
  spiceLevels: ['Không cay', 'Cay vừa'],
};

const pho = { name: 'Phở Tái', price: 65000, discountPrice: 55000, options: noodleOptions };

describe('effectiveBasePrice', () => {
  it('dùng giá giảm khi hợp lệ', () => expect(effectiveBasePrice(pho)).toBe(55000));
  it('bỏ qua giá giảm không hợp lệ (0, âm, lớn hơn hoặc bằng giá gốc, null)', () => {
    expect(effectiveBasePrice({ price: 50000, discountPrice: 0 })).toBe(50000);
    expect(effectiveBasePrice({ price: 50000, discountPrice: -1 })).toBe(50000);
    expect(effectiveBasePrice({ price: 50000, discountPrice: 50000 })).toBe(50000);
    expect(effectiveBasePrice({ price: 50000, discountPrice: 60000 })).toBe(50000);
    expect(effectiveBasePrice({ price: 50000, discountPrice: null })).toBe(50000);
  });
});

describe('priceOrderLine', () => {
  it('không chọn gì: lấy size mặc định (đầu tiên) và giá giảm', () => {
    const r = priceOrderLine(pho, {});
    expect(r.unitPrice).toBe(55000);
    expect(r.selected?.size?.id).toBe('to_thuong');
  });

  it('cộng giá size và topping vào giá giảm', () => {
    const r = priceOrderLine(pho, { sizeId: 'to_dac_biet', toppingIds: ['quay', 'trung'], level: 'Cay vừa' });
    expect(r.unitPrice).toBe(55000 + 15000 + 8000 + 7000);
    expect(r.selected?.toppings.map((t) => t.id)).toEqual(['quay', 'trung']);
    expect(r.selected?.level).toBe('Cay vừa');
  });

  it('món không có tuỳ chọn: giá gốc, không lưu tuỳ chọn', () => {
    const r = priceOrderLine({ name: 'Trà chanh', price: 15000 }, {});
    expect(r).toEqual({ unitPrice: 15000, selected: null });
  });

  it('từ chối size, topping, mức không thuộc món', () => {
    expect(() => priceOrderLine(pho, { sizeId: 'XL' })).toThrow(OrderPricingError);
    expect(() => priceOrderLine(pho, { toppingIds: ['pho_mai'] })).toThrow(OrderPricingError);
    expect(() => priceOrderLine(pho, { level: 'Siêu cay' })).toThrow(OrderPricingError);
    expect(() => priceOrderLine({ name: 'Trà chanh', price: 15000 }, { toppingIds: ['quay'] })).toThrow(
      OrderPricingError,
    );
  });

  it('từ chối topping chọn trùng', () => {
    expect(() => priceOrderLine(pho, { toppingIds: ['quay', 'quay'] })).toThrow(OrderPricingError);
  });

  it('bỏ qua JSON tuỳ chọn sai định dạng thay vì tính sai giá', () => {
    const r = priceOrderLine({ name: 'X', price: 30000, options: { sizes: [{ id: 1 }], toppings: 'abc' } }, {});
    expect(r.unitPrice).toBe(30000);
  });
});

describe('lineKey', () => {
  it('cùng món, cùng tuỳ chọn (khác thứ tự topping) thì cùng khoá', () => {
    expect(lineKey('m1', { sizeId: 'L', toppingIds: ['a', 'b'] })).toBe(lineKey('m1', { sizeId: 'L', toppingIds: ['b', 'a'] }));
  });
  it('khác tuỳ chọn thì khác khoá', () => {
    expect(lineKey('m1', { sizeId: 'L' })).not.toBe(lineKey('m1', { sizeId: 'M' }));
  });
});
