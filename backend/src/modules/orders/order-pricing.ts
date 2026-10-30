/**
 * Tính đơn giá một dòng món từ dữ liệu trong DB (không tin giá client gửi lên).
 *
 * Đơn giá = giá cơ sở + giá size + tổng giá topping
 *  - Giá cơ sở: discountPrice nếu hợp lệ (0 < discountPrice < price), ngược lại price.
 *  - Size: theo sizeId; nếu không gửi mà món có danh sách size thì lấy size đầu tiên (mặc định).
 *  - Topping: mỗi id phải có trong danh sách topping của món, không trùng.
 *  - Mức (cay/đường): phải nằm trong spiceLevels hoặc sugarLevels của món; không ảnh hưởng giá.
 */

export interface PricedOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuOptions {
  sizes?: PricedOption[];
  toppings?: PricedOption[];
  spiceLevels?: string[];
  sugarLevels?: string[];
}

export interface PricingMenuItem {
  name: string;
  price: number;
  discountPrice?: number | null;
  options?: unknown;
}

export interface LineSelection {
  sizeId?: string;
  toppingIds?: string[];
  level?: string;
}

export interface SelectedOptions {
  size?: { id: string; name: string; price: number };
  toppings: { id: string; name: string; price: number }[];
  level?: string;
}

export class OrderPricingError extends Error {}

const isPricedList = (v: unknown): v is PricedOption[] =>
  Array.isArray(v) &&
  v.every((o) => o && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.price === 'number');

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** Đọc cột JSON `options` một cách an toàn; bỏ qua phần sai định dạng. */
export function parseMenuOptions(raw: unknown): MenuOptions {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    sizes: isPricedList(o.sizes) ? o.sizes : undefined,
    toppings: isPricedList(o.toppings) ? o.toppings : undefined,
    spiceLevels: isStringList(o.spiceLevels) ? o.spiceLevels : undefined,
    sugarLevels: isStringList(o.sugarLevels) ? o.sugarLevels : undefined,
  };
}

export function effectiveBasePrice(item: Pick<PricingMenuItem, 'price' | 'discountPrice'>): number {
  const d = item.discountPrice;
  return d !== null && d !== undefined && d > 0 && d < item.price ? d : item.price;
}

export function priceOrderLine(
  item: PricingMenuItem,
  sel: LineSelection,
): { unitPrice: number; selected: SelectedOptions | null } {
  const opts = parseMenuOptions(item.options);
  const selected: SelectedOptions = { toppings: [] };

  if (sel.sizeId !== undefined) {
    const size = opts.sizes?.find((s) => s.id === sel.sizeId);
    if (!size) throw new OrderPricingError(`Món "${item.name}" không có size đã chọn`);
    selected.size = size;
  } else if (opts.sizes && opts.sizes.length > 0) {
    selected.size = opts.sizes[0];
  }

  const toppingIds = sel.toppingIds ?? [];
  if (new Set(toppingIds).size !== toppingIds.length) {
    throw new OrderPricingError(`Món "${item.name}" có topping bị chọn trùng`);
  }
  for (const id of toppingIds) {
    const t = opts.toppings?.find((x) => x.id === id);
    if (!t) throw new OrderPricingError(`Món "${item.name}" không có topping đã chọn`);
    selected.toppings.push(t);
  }

  if (sel.level !== undefined) {
    const levels = [...(opts.spiceLevels ?? []), ...(opts.sugarLevels ?? [])];
    if (!levels.includes(sel.level)) throw new OrderPricingError(`Món "${item.name}" không có mức đã chọn`);
    selected.level = sel.level;
  }

  const unitPrice =
    effectiveBasePrice(item) + (selected.size?.price ?? 0) + selected.toppings.reduce((s, t) => s + t.price, 0);
  const hasOptions = !!selected.size || selected.toppings.length > 0 || !!selected.level;
  return { unitPrice, selected: hasOptions ? selected : null };
}

/** Khoá gộp dòng: cùng món và cùng tuỳ chọn thì cộng số lượng. */
export function lineKey(menuItemId: string, sel: LineSelection): string {
  return [menuItemId, sel.sizeId ?? '', [...(sel.toppingIds ?? [])].sort().join(','), sel.level ?? ''].join('|');
}
