import { formatRestockTime, nextStockResetAt, stockStatusOf } from './menuStock';

// 2026-11-04 12:00 giờ VN
const NOON_VN = new Date('2026-11-04T05:00:00Z');

describe('menuStock', () => {
  it('cùng công thức với backend: mở bán lại 04:00 sáng mai giờ VN', () => {
    expect(nextStockResetAt(NOON_VN).toISOString()).toBe('2026-11-04T21:00:00.000Z');
    expect(formatRestockTime(nextStockResetAt(NOON_VN), NOON_VN)).toBe('04:00 sáng mai');
  });

  it('bấm hết lúc 01:00 sáng thì mở lại 04:00 cùng ngày', () => {
    const oneAm = new Date('2026-11-04T18:00:00Z');
    expect(formatRestockTime(nextStockResetAt(oneAm), oneAm)).toBe('04:00 hôm nay');
  });

  it('stockStatusOf: hết hôm nay chỉ khi mốc còn ở tương lai', () => {
    expect(stockStatusOf({ isAvailable: true }, NOON_VN)).toBe('AVAILABLE');
    expect(stockStatusOf({ isAvailable: false, soldOutUntil: '2026-11-04T21:00:00Z' }, NOON_VN)).toBe('SOLD_OUT_TODAY');
    expect(stockStatusOf({ isAvailable: false, soldOutUntil: '2026-11-04T01:00:00Z' }, NOON_VN)).toBe('SOLD_OUT');
    expect(stockStatusOf({ isAvailable: false, soldOutUntil: null }, NOON_VN)).toBe('SOLD_OUT');
  });
});
