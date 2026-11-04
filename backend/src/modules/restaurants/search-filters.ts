import { VoucherType } from '@prisma/client';

export const SEARCH_SORTS = ['relevance', 'distance', 'rating', 'popular'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/**
 * Khoảng cách lớn nhất (km, đường chim bay) mà phí ship ước tính vẫn ≤ maxFee.
 * Phí ship chỉ tăng theo khoảng cách nên tìm nhị phân được; dùng để lọc "phí ship tối đa" ngay trong SQL.
 * Trả về -1 nếu kể cả 0 km cũng vượt maxFee (không quán nào thoả).
 */
export function maxDistanceForFee(maxFee: number, feeAt: (km: number) => number, upperKm = 50): number {
  if (feeAt(0) > maxFee) return -1;
  if (feeAt(upperKm) <= maxFee) return upperKm;
  let lo = 0;
  let hi = upperKm;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (feeAt(mid) <= maxFee) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 1000) / 1000;
}

/** Nhãn ưu đãi ngắn hiển thị trên thẻ quán: mã của quán giảm nhiều nhất, không có thì "Món giảm giá". */
export function promoLabelFor(
  vouchers: { discountType: VoucherType; discountValue: number; maxDiscountAmount: number | null }[],
  hasDiscountedDish: boolean,
): string | null {
  const score = (v: (typeof vouchers)[number]) =>
    v.discountType === 'FIXED_AMOUNT'
      ? v.discountValue
      : v.discountType === 'PERCENTAGE'
        ? (v.maxDiscountAmount ?? 0)
        : 1; // freeship xếp sau mã giảm tiền
  const best = [...vouchers].sort((a, b) => score(b) - score(a))[0];
  if (best) {
    if (best.discountType === 'FIXED_AMOUNT') return `Giảm ${Math.round(best.discountValue / 1000)}K`;
    if (best.discountType === 'PERCENTAGE') return `Giảm ${best.discountValue}%`;
    return 'Freeship';
  }
  return hasDiscountedDish ? 'Món giảm giá' : null;
}
