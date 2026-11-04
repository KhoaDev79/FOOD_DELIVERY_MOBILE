import { formatRestockTime, nextStockResetAt, stockPatch, stockStatusOf } from '../menus/menu-stock.util';
import { CartCheckMenuItem, CartCheckRestaurant, checkCart } from './cart-check';

// 2026-11-04 12:00 giờ VN (thứ Tư)
const NOON_VN = new Date('2026-11-04T05:00:00Z');

describe('menu-stock.util', () => {
  it('"hết hôm nay" mở bán lại lúc 04:00 sáng mai (giờ VN)', () => {
    expect(nextStockResetAt(NOON_VN).toISOString()).toBe('2026-11-04T21:00:00.000Z'); // 05/11 04:00 VN
  });

  it('quán bán đêm bấm hết lúc 01:00 sáng thì mở lại 04:00 cùng ngày, không đợi qua ngày sau', () => {
    const oneAmVn = new Date('2026-11-04T18:00:00Z'); // 05/11 01:00 VN
    expect(nextStockResetAt(oneAmVn).toISOString()).toBe('2026-11-04T21:00:00.000Z');
    expect(formatRestockTime(nextStockResetAt(oneAmVn), oneAmVn)).toBe('04:00 hôm nay');
  });

  it('đúng 04:00 thì lấy mốc ngày hôm sau', () => {
    const fourAm = new Date('2026-11-04T21:00:00Z');
    expect(nextStockResetAt(fourAm).toISOString()).toBe('2026-11-05T21:00:00.000Z');
  });

  it('stockPatch / stockStatusOf', () => {
    expect(stockPatch('AVAILABLE', NOON_VN)).toEqual({ isAvailable: true, soldOutUntil: null });
    expect(stockPatch('SOLD_OUT', NOON_VN)).toEqual({ isAvailable: false, soldOutUntil: null });
    const today = stockPatch('SOLD_OUT_TODAY', NOON_VN);
    expect(today.isAvailable).toBe(false);
    expect(stockStatusOf(today, NOON_VN)).toBe('SOLD_OUT_TODAY');
    expect(stockStatusOf({ isAvailable: false, soldOutUntil: null }, NOON_VN)).toBe('SOLD_OUT');
    expect(formatRestockTime(today.soldOutUntil!, NOON_VN)).toBe('04:00 sáng mai');
  });
});

describe('checkCart', () => {
  const restaurant: CartCheckRestaurant = {
    id: 'r1',
    name: 'Phở Thìn',
    status: 'ACTIVE',
    isOpen: true,
    openTime: '06:00',
    closeTime: '22:00',
    pausedUntil: null,
    openingHours: [],
    specialClosings: [],
  };
  const dish = (over: Partial<CartCheckMenuItem> = {}): CartCheckMenuItem => ({
    id: 'm1',
    name: 'Phở tái',
    restaurantId: 'r1',
    price: 60000,
    discountPrice: null,
    options: { sizes: [{ id: 'thuong', name: 'Tô thường', price: 0 }, { id: 'lon', name: 'Tô lớn', price: 10000 }] },
    isAvailable: true,
    isArchived: false,
    soldOutUntil: null,
    availableFrom: null,
    availableTo: null,
    ...over,
  });
  const line = (over = {}) => ({ lineKey: 'k1', menuItemId: 'm1', quantity: 1, unitPrice: 60000, ...over });

  it('mọi thứ ổn thì cho thanh toán', () => {
    const res = checkCart(restaurant, [dish()], [line()], NOON_VN);
    expect(res).toMatchObject({ canCheckout: true, issueCount: 0, restaurant: { status: 'OPEN' } });
    expect(res.lines[0]).toMatchObject({ status: 'OK', unitPrice: 60000 });
  });

  it('món hết hôm nay: chặn đặt, báo giờ mở bán lại', () => {
    const until = nextStockResetAt(NOON_VN);
    const res = checkCart(restaurant, [dish({ isAvailable: false, soldOutUntil: until })], [line()], NOON_VN);
    expect(res.canCheckout).toBe(false);
    expect(res.lines[0]).toMatchObject({
      status: 'SOLD_OUT',
      blocking: true,
      message: 'Hết hôm nay, mở bán lại 04:00 sáng mai.',
      soldOutUntil: until.toISOString(),
    });
  });

  it('món tạm hết (không hẹn giờ), món bị xoá, món của quán khác', () => {
    const res = checkCart(
      restaurant,
      [dish({ isAvailable: false }), dish({ id: 'm2', isArchived: true }), dish({ id: 'm3', restaurantId: 'r9' })],
      [line(), line({ lineKey: 'k2', menuItemId: 'm2' }), line({ lineKey: 'k3', menuItemId: 'm3' }), line({ lineKey: 'k4', menuItemId: 'mx' })],
      NOON_VN,
    );
    expect(res.lines.map((l) => l.status)).toEqual(['SOLD_OUT', 'REMOVED', 'REMOVED', 'REMOVED']);
    expect(res.lines[0].message).toBe('Món tạm hết.');
    expect(res.issueCount).toBe(4);
  });

  it('món ngoài khung giờ bán', () => {
    const res = checkCart(restaurant, [dish({ availableFrom: '06:00', availableTo: '10:30' })], [line()], NOON_VN);
    expect(res.lines[0]).toMatchObject({ status: 'OUT_OF_HOURS', blocking: true, message: 'Chỉ bán 06:00 – 10:30.' });
  });

  it('đổi giá: báo nhưng không chặn, trả giá mới để app cập nhật', () => {
    const res = checkCart(restaurant, [dish({ discountPrice: 50000 })], [line()], NOON_VN);
    expect(res.canCheckout).toBe(true);
    expect(res.lines[0]).toMatchObject({ status: 'PRICE_CHANGED', blocking: false, unitPrice: 50000, previousUnitPrice: 60000 });
    expect(res.issueCount).toBe(1);
  });

  it('tuỳ chọn không còn (size bị xoá) thì phải chọn lại', () => {
    const res = checkCart(restaurant, [dish()], [line({ sizeId: 'size-da-xoa' })], NOON_VN);
    expect(res.lines[0]).toMatchObject({ status: 'OPTION_CHANGED', blocking: true });
  });

  it('trạng thái quán: đóng cửa, tạm nghỉ, ngoài giờ, ngừng hoạt động', () => {
    expect(checkCart({ ...restaurant, isOpen: false }, [dish()], [line()], NOON_VN).restaurant.status).toBe('CLOSED');
    const paused = checkCart({ ...restaurant, pausedUntil: new Date('2026-11-04T06:00:00Z') }, [dish()], [line()], NOON_VN);
    expect(paused.restaurant).toMatchObject({ status: 'PAUSED', message: 'Quán tạm nghỉ, mở lại lúc 13:00 hôm nay.' });
    expect(paused.canCheckout).toBe(false);
    expect(checkCart({ ...restaurant, openTime: '17:00' }, [dish()], [line()], NOON_VN).restaurant.status).toBe('OUTSIDE_HOURS');
    expect(checkCart({ ...restaurant, status: 'SUSPENDED' }, [dish()], [line()], NOON_VN).restaurant.status).toBe('INACTIVE');
    expect(checkCart(null, [], [line()], NOON_VN).restaurant.status).toBe('INACTIVE');
  });
});
