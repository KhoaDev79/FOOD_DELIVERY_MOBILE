import { VoucherFunding, VoucherType } from '@prisma/client';

/** Lý do khi mã không tồn tại (dùng để đếm số lần dò mã). */
export const VOUCHER_NOT_FOUND_REASON = 'Mã không tồn tại';

/** Dữ liệu voucher tối thiểu để xét điều kiện (khớp các cột trong bảng vouchers). */
export interface VoucherRuleInput {
  id: string;
  code: string;
  title: string;
  discountType: VoucherType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  maxUsage: number;
  usedCount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  restaurantId: string | null;
  userId: string | null;
  perUserLimit: number;
  onlyNewCustomer: boolean;
  fundedBy: VoucherFunding;
}

export interface VoucherContext {
  now: Date;
  userId: string;
  restaurantId: string;
  subtotal: number;
  deliveryFee: number;
  /** Số lần khách này đã dùng mã (không tính lượt đã hoàn) */
  userUsageCount: number;
  /** Số đơn giao thành công của khách (để xét mã "khách mới") */
  deliveredOrdersCount: number;
}

export type VoucherSlot = 'DISCOUNT' | 'FREESHIP';

export interface VoucherEvaluation {
  eligible: boolean;
  /** Lý do không dùng được, hiển thị nguyên văn cho khách */
  reason?: string;
  /** Giảm trên tiền món */
  discount: number;
  /** Giảm trên phí giao */
  shippingDiscount: number;
  slot: VoucherSlot;
}

export const VOUCHER_CODE_RE = /^[A-Z0-9]{4,20}$/;

export const normalizeVoucherCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export const slotOf = (type: VoucherType): VoucherSlot => (type === 'FREE_SHIP' ? 'FREESHIP' : 'DISCOUNT');

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;

/** Số tiền giảm khi mã đủ điều kiện (chưa xét điều kiện). Giảm theo % làm tròn xuống bội số 1.000 ₫. */
export function computeVoucherAmount(
  v: Pick<VoucherRuleInput, 'discountType' | 'discountValue' | 'maxDiscountAmount'>,
  subtotal: number,
  deliveryFee: number,
): { discount: number; shippingDiscount: number } {
  switch (v.discountType) {
    case 'FIXED_AMOUNT':
      return { discount: Math.max(0, Math.min(v.discountValue, subtotal)), shippingDiscount: 0 };
    case 'PERCENTAGE': {
      let amount = Math.floor((subtotal * v.discountValue) / 100 / 1000) * 1000;
      if (v.maxDiscountAmount && v.maxDiscountAmount > 0) amount = Math.min(amount, v.maxDiscountAmount);
      return { discount: Math.max(0, Math.min(amount, subtotal)), shippingDiscount: 0 };
    }
    case 'FREE_SHIP': {
      // discountValue = mức giảm tối đa; 0 nghĩa là miễn toàn bộ phí giao
      const cap = v.discountValue > 0 ? v.discountValue : deliveryFee;
      return { discount: 0, shippingDiscount: Math.max(0, Math.min(cap, deliveryFee)) };
    }
    default:
      return { discount: 0, shippingDiscount: 0 };
  }
}

/** Xét một voucher với giỏ hàng hiện tại. Thứ tự kiểm tra: lý do khách hiểu rõ nhất được báo trước. */
export function evaluateVoucher(v: VoucherRuleInput, ctx: VoucherContext): VoucherEvaluation {
  const slot = slotOf(v.discountType);
  const fail = (reason: string): VoucherEvaluation => ({ eligible: false, reason, discount: 0, shippingDiscount: 0, slot });

  if (!v.isActive) return fail('Mã đã ngừng áp dụng');
  if (v.userId && v.userId !== ctx.userId) return fail('Mã không thuộc tài khoản của bạn');
  if (ctx.now < v.startDate) return fail(`Mã áp dụng từ ${v.startDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  if (ctx.now > v.endDate) return fail('Mã đã hết hạn');
  if (v.restaurantId && v.restaurantId !== ctx.restaurantId) return fail('Mã chỉ áp dụng cho quán khác');
  if (v.usedCount >= v.maxUsage) return fail('Mã đã hết lượt sử dụng');
  if (ctx.userUsageCount >= v.perUserLimit) {
    return fail(v.perUserLimit === 1 ? 'Bạn đã dùng mã này rồi' : `Bạn đã dùng hết ${v.perUserLimit} lượt của mã này`);
  }
  if (v.onlyNewCustomer && ctx.deliveredOrdersCount > 0) return fail('Mã chỉ dành cho khách đặt đơn đầu tiên');
  if (ctx.subtotal < v.minOrderAmount) {
    return fail(`Đơn tối thiểu ${vnd(v.minOrderAmount)} (còn thiếu ${vnd(v.minOrderAmount - ctx.subtotal)})`);
  }

  const amount = computeVoucherAmount(v, ctx.subtotal, ctx.deliveryFee);
  if (amount.discount + amount.shippingDiscount <= 0) return fail('Mã không giảm được cho đơn này');
  return { eligible: true, ...amount, slot };
}

export interface AppliedVoucher {
  voucher: VoucherRuleInput;
  discount: number;
  shippingDiscount: number;
}

export interface VoucherSelectionResult {
  applied: AppliedVoucher[];
  rejected: { code: string; reason: string }[];
  discount: number;
  shippingDiscount: number;
  /** Phần do quán chịu (trừ vào doanh thu quán) */
  restaurantDiscount: number;
}

/**
 * Áp dụng các mã khách chọn: tối đa 1 mã giảm giá + 1 mã freeship mỗi đơn.
 * Mã không tồn tại, không đủ điều kiện hoặc trùng loại thì bị từ chối kèm lý do (không làm hỏng báo giá).
 */
export function applyVoucherSelection(
  requestedCodes: string[],
  vouchersByCode: Map<string, VoucherRuleInput>,
  ctxFor: (v: VoucherRuleInput) => VoucherContext,
): VoucherSelectionResult {
  const result: VoucherSelectionResult = { applied: [], rejected: [], discount: 0, shippingDiscount: 0, restaurantDiscount: 0 };
  const usedSlots = new Set<VoucherSlot>();
  const seen = new Set<string>();

  for (const raw of requestedCodes) {
    const code = normalizeVoucherCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const v = vouchersByCode.get(code);
    if (!v) {
      result.rejected.push({ code, reason: VOUCHER_NOT_FOUND_REASON });
      continue;
    }
    const ev = evaluateVoucher(v, ctxFor(v));
    if (!ev.eligible) {
      result.rejected.push({ code, reason: ev.reason! });
      continue;
    }
    if (usedSlots.has(ev.slot)) {
      result.rejected.push({
        code,
        reason: ev.slot === 'FREESHIP' ? 'Mỗi đơn chỉ dùng 1 mã freeship' : 'Mỗi đơn chỉ dùng 1 mã giảm giá',
      });
      continue;
    }
    usedSlots.add(ev.slot);
    result.applied.push({ voucher: v, discount: ev.discount, shippingDiscount: ev.shippingDiscount });
    result.discount += ev.discount;
    result.shippingDiscount += ev.shippingDiscount;
    if (v.fundedBy === 'RESTAURANT') result.restaurantDiscount += ev.discount + ev.shippingDiscount;
  }
  return result;
}
