/**
 * Gợi ý món thêm vào giỏ (kiểu "Thường được đặt cùng" của GrabFood / ShopeeFood).
 *
 * Thứ tự ưu tiên, chỉ dùng số liệu thật từ các đơn ĐÃ GIAO của quán:
 *  1. BOUGHT_TOGETHER: món hay nằm chung đơn với các món đang có trong giỏ.
 *  2. BEST_SELLER: món bán chạy của quán (khi chưa đủ dữ liệu mua kèm).
 *  3. MENU: món khác của quán, ưu tiên nhóm món khác với món trong giỏ (vd đang có món chính -> gợi ý đồ uống).
 * Luôn bỏ: món đã có trong giỏ, món hết hàng, món đã xoá.
 */
export type SuggestionReason = 'BOUGHT_TOGETHER' | 'BEST_SELLER' | 'MENU';

export const SUGGESTION_WINDOW_DAYS = 90;
export const SUGGESTION_LIMIT = 8;

export interface SuggestionCandidate {
  id: string;
  categoryId: string | null;
  isAvailable: boolean;
  isArchived: boolean;
}

export function rankSuggestions<T extends SuggestionCandidate>(input: {
  menu: T[];
  /** menuItemId -> số đơn có mua chung với món trong giỏ */
  boughtTogether: Map<string, number>;
  /** menuItemId -> số phần đã bán */
  bestSellers: Map<string, number>;
  /** món đang có trong giỏ */
  cartItemIds: string[];
  limit?: number;
}): { item: T; reason: SuggestionReason; count: number }[] {
  const { menu, boughtTogether, bestSellers, cartItemIds, limit = SUGGESTION_LIMIT } = input;
  const inCart = new Set(cartItemIds);
  const usable = menu.filter((m) => m.isAvailable && !m.isArchived && !inCart.has(m.id));
  const byId = new Map(usable.map((m) => [m.id, m]));
  const picked = new Set<string>();
  const out: { item: T; reason: SuggestionReason; count: number }[] = [];

  const push = (id: string, reason: SuggestionReason, count: number) => {
    const item = byId.get(id);
    if (!item || picked.has(id) || out.length >= limit) return;
    picked.add(id);
    out.push({ item, reason, count });
  };

  [...boughtTogether.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, n]) => push(id, 'BOUGHT_TOGETHER', n));
  [...bestSellers.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, n]) => push(id, 'BEST_SELLER', n));

  // Còn chỗ: món khác của quán, nhóm món khác với giỏ lên trước
  const cartCategories = new Set(menu.filter((m) => inCart.has(m.id)).map((m) => m.categoryId));
  usable
    .filter((m) => !picked.has(m.id))
    .sort((a, b) => Number(cartCategories.has(a.categoryId)) - Number(cartCategories.has(b.categoryId)))
    .forEach((m) => push(m.id, 'MENU', 0));

  return out;
}
