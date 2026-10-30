/** Các mức giảm giá chủ quán được chọn cho một món (%). 0 = không giảm. */
export const DISCOUNT_PERCENTS = [0, 5, 7, 10, 15, 20] as const;

/**
 * Giá sau giảm, làm tròn tới 100 ₫. Trả về null khi không giảm (khớp quy tắc ở order-pricing:
 * chỉ dùng discountPrice khi 0 < discountPrice < price).
 */
export function discountPriceFor(price: number, percent: number): number | null {
  if (!percent) return null;
  const value = Math.round((price * (100 - percent)) / 100 / 100) * 100;
  return value > 0 && value < price ? value : null;
}

/** Phần trăm giảm đang áp dụng (làm tròn), suy ra từ giá gốc và giá giảm. */
export function discountPercentOf(price: number, discountPrice?: number | null): number {
  if (!discountPrice || discountPrice <= 0 || discountPrice >= price) return 0;
  return Math.round((1 - discountPrice / price) * 100);
}
