import {
  applyVoucherSelection,
  computeVoucherAmount,
  evaluateVoucher,
  normalizeVoucherCode,
  VoucherContext,
  VoucherRuleInput,
} from './voucher-rules';

const NOW = new Date('2026-11-04T05:00:00Z');

const base = (over: Partial<VoucherRuleInput> = {}): VoucherRuleInput => ({
  id: 'v1',
  code: 'GIAM20K',
  title: 'Giảm 20k',
  discountType: 'FIXED_AMOUNT',
  discountValue: 20_000,
  maxDiscountAmount: null,
  minOrderAmount: 0,
  maxUsage: 100,
  usedCount: 0,
  startDate: new Date('2026-11-01T00:00:00Z'),
  endDate: new Date('2026-11-30T00:00:00Z'),
  isActive: true,
  restaurantId: null,
  userId: null,
  perUserLimit: 1,
  onlyNewCustomer: false,
  fundedBy: 'PLATFORM',
  ...over,
});

const ctx = (over: Partial<VoucherContext> = {}): VoucherContext => ({
  now: NOW,
  userId: 'u1',
  restaurantId: 'r1',
  subtotal: 100_000,
  deliveryFee: 20_000,
  userUsageCount: 0,
  deliveredOrdersCount: 3,
  ...over,
});

describe('voucher-rules', () => {
  describe('computeVoucherAmount', () => {
    it('giảm cố định không vượt tiền món', () => {
      expect(computeVoucherAmount(base({ discountValue: 50_000 }), 30_000, 15_000)).toEqual({ discount: 30_000, shippingDiscount: 0 });
    });

    it('giảm % làm tròn xuống 1.000 ₫ và có trần', () => {
      const v = base({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscountAmount: 25_000 });
      expect(computeVoucherAmount(v, 123_456, 0).discount).toBe(18_000);
      expect(computeVoucherAmount(v, 500_000, 0).discount).toBe(25_000);
    });

    it('freeship chỉ giảm phí giao, có mức tối đa; 0 = miễn toàn bộ', () => {
      expect(computeVoucherAmount(base({ discountType: 'FREE_SHIP', discountValue: 15_000 }), 100_000, 22_000)).toEqual({
        discount: 0,
        shippingDiscount: 15_000,
      });
      expect(computeVoucherAmount(base({ discountType: 'FREE_SHIP', discountValue: 0 }), 100_000, 22_000).shippingDiscount).toBe(22_000);
    });
  });

  describe('evaluateVoucher', () => {
    it('đủ điều kiện', () => {
      expect(evaluateVoucher(base(), ctx())).toMatchObject({ eligible: true, discount: 20_000 });
    });

    it.each([
      ['ngừng áp dụng', base({ isActive: false }), ctx(), 'ngừng áp dụng'],
      ['hết hạn', base(), ctx({ now: new Date('2026-12-01T00:00:00Z') }), 'hết hạn'],
      ['chưa tới ngày', base({ startDate: new Date('2026-11-10T00:00:00Z') }), ctx(), 'áp dụng từ'],
      ['hết lượt', base({ maxUsage: 5, usedCount: 5 }), ctx(), 'hết lượt'],
      ['đã dùng', base(), ctx({ userUsageCount: 1 }), 'đã dùng mã này'],
      ['quán khác', base({ restaurantId: 'r2' }), ctx(), 'quán khác'],
      ['mã cá nhân người khác', base({ userId: 'u2' }), ctx(), 'không thuộc tài khoản'],
      ['khách mới', base({ onlyNewCustomer: true }), ctx(), 'đơn đầu tiên'],
      ['đơn tối thiểu', base({ minOrderAmount: 150_000 }), ctx(), 'còn thiếu 50.000 ₫'],
    ])('từ chối: %s', (_name, v, c, reason) => {
      const ev = evaluateVoucher(v, c);
      expect(ev.eligible).toBe(false);
      expect(ev.reason).toContain(reason);
    });

    it('khách mới chưa có đơn giao thành công thì dùng được', () => {
      expect(evaluateVoucher(base({ onlyNewCustomer: true }), ctx({ deliveredOrdersCount: 0 })).eligible).toBe(true);
    });

    it('cho dùng nhiều lần theo perUserLimit', () => {
      expect(evaluateVoucher(base({ perUserLimit: 3 }), ctx({ userUsageCount: 2 })).eligible).toBe(true);
      expect(evaluateVoucher(base({ perUserLimit: 3 }), ctx({ userUsageCount: 3 })).reason).toContain('hết 3 lượt');
    });
  });

  describe('applyVoucherSelection', () => {
    const vouchers = new Map<string, VoucherRuleInput>([
      ['GIAM20K', base()],
      ['GIAM10', base({ id: 'v2', code: 'GIAM10', discountType: 'PERCENTAGE', discountValue: 10, maxDiscountAmount: 30_000 })],
      ['FREESHIP', base({ id: 'v3', code: 'FREESHIP', discountType: 'FREE_SHIP', discountValue: 0 })],
      ['QUAN15K', base({ id: 'v4', code: 'QUAN15K', discountValue: 15_000, restaurantId: 'r1', fundedBy: 'RESTAURANT' })],
    ]);

    it('1 mã giảm giá + 1 mã freeship', () => {
      const r = applyVoucherSelection(['giam20k', 'FREESHIP'], vouchers, () => ctx());
      expect(r.discount).toBe(20_000);
      expect(r.shippingDiscount).toBe(20_000);
      expect(r.rejected).toEqual([]);
    });

    it('2 mã giảm giá: mã sau bị từ chối', () => {
      const r = applyVoucherSelection(['GIAM20K', 'GIAM10'], vouchers, () => ctx());
      expect(r.applied).toHaveLength(1);
      expect(r.rejected[0]).toEqual({ code: 'GIAM10', reason: 'Mỗi đơn chỉ dùng 1 mã giảm giá' });
    });

    it('mã không tồn tại không làm hỏng báo giá', () => {
      const r = applyVoucherSelection(['KHONGCO'], vouchers, () => ctx());
      expect(r.discount).toBe(0);
      expect(r.rejected[0].reason).toBe('Mã không tồn tại');
    });

    it('mã của quán: ghi nhận phần quán chịu', () => {
      const r = applyVoucherSelection(['QUAN15K', 'FREESHIP'], vouchers, () => ctx());
      expect(r.restaurantDiscount).toBe(15_000);
    });

    it('chuẩn hoá mã: bỏ khoảng trắng, chữ hoa', () => {
      expect(normalizeVoucherCode(' giam 20k ')).toBe('GIAM20K');
    });
  });
});
