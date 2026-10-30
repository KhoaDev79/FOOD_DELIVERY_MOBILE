import { MenuItem, MenuItemOptions, PricedOption } from '../types/api';

/**
 * Tính giá món phía app, cùng quy tắc với backend (backend/src/modules/orders/order-pricing.ts)
 * để số tiền hiển thị khớp số tiền thật bị tính:
 *  đơn giá = giá cơ sở (giá giảm nếu 0 < giá giảm < giá gốc) + giá size + tổng giá topping.
 *  Không chọn size mà món có size thì lấy size đầu tiên.
 */

export interface LineSelection {
  sizeId?: string;
  toppingIds?: string[];
  level?: string;
}

const isPricedList = (v: unknown): v is PricedOption[] =>
  Array.isArray(v) &&
  v.every((o) => o && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.price === 'number');
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

export function parseOptions(raw: unknown): MenuItemOptions {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    sizes: isPricedList(o.sizes) && o.sizes.length > 0 ? o.sizes : undefined,
    toppings: isPricedList(o.toppings) && o.toppings.length > 0 ? o.toppings : undefined,
    spiceLevels: isStringList(o.spiceLevels) && o.spiceLevels.length > 0 ? o.spiceLevels : undefined,
    sugarLevels: isStringList(o.sugarLevels) && o.sugarLevels.length > 0 ? o.sugarLevels : undefined,
  };
}

export function hasChoices(item: Pick<MenuItem, 'options'>): boolean {
  const o = parseOptions(item.options);
  return !!(o.sizes || o.toppings || o.spiceLevels || o.sugarLevels);
}

export function effectiveBasePrice(item: Pick<MenuItem, 'price' | 'discountPrice'>): number {
  const d = item.discountPrice;
  return d !== null && d !== undefined && d > 0 && d < item.price ? d : item.price;
}

/** Phần trăm giảm làm tròn (0 nếu không giảm). */
export function discountPercent(item: Pick<MenuItem, 'price' | 'discountPrice'>): number {
  const base = effectiveBasePrice(item);
  return base < item.price ? Math.round(((item.price - base) / item.price) * 100) : 0;
}

/** Đơn giá theo lựa chọn; bỏ qua mã không thuộc món (backend sẽ từ chối các mã đó). */
export function linePrice(
  item: Pick<MenuItem, 'price' | 'discountPrice' | 'options'>,
  sel: LineSelection = {},
): number {
  const o = parseOptions(item.options);
  const size = sel.sizeId ? o.sizes?.find((s) => s.id === sel.sizeId) : o.sizes?.[0];
  const toppings = (sel.toppingIds ?? []).map((id) => o.toppings?.find((t) => t.id === id)?.price ?? 0);
  return effectiveBasePrice(item) + (size?.price ?? 0) + toppings.reduce((a, b) => a + b, 0);
}

/** Giá gốc tương ứng (không giảm) để hiển thị gạch ngang. */
export function originalLinePrice(item: Pick<MenuItem, 'price' | 'options'>, sel: LineSelection = {}): number {
  return linePrice({ ...item, discountPrice: null }, sel);
}
