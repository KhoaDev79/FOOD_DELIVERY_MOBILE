import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MenuOptions, parseMenuOptions, PricedOption } from '../orders/order-pricing';

/** Giới hạn tuỳ chọn của một món (khớp bảng chọn của khách: tối đa 10 topping). */
export const MAX_SIZES = 10;
export const MAX_TOPPINGS = 10;
export const MAX_LEVELS = 6;
export const MAX_OPTION_PRICE = 500_000;

export interface OptionInput {
  id?: string;
  name: string;
  price: number;
}

export interface MenuOptionsInput {
  sizes?: OptionInput[];
  toppings?: OptionInput[];
  spiceLevels?: string[];
  sugarLevels?: string[];
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Chuẩn hoá tuỳ chọn chủ quán gửi lên trước khi lưu:
 * - Bỏ dòng trống, gộp khoảng trắng; báo lỗi khi trùng tên trong cùng danh sách.
 * - id do backend cấp. Giữ nguyên id cũ nếu lựa chọn đó đã có (theo id, hoặc trùng tên)
 *   để món đang nằm trong giỏ của khách vẫn đặt được sau khi quán sửa giá/tên.
 * - Chỉ dùng một loại mức: mức cay HOẶC mức đường (bảng chọn của khách chỉ hiện một loại).
 * - Không còn gì thì trả null (xoá tuỳ chọn của món).
 */
export function normalizeMenuOptions(input: MenuOptionsInput | null | undefined, previous?: unknown): MenuOptions | null {
  if (!input) return null;
  const prev = parseMenuOptions(previous);

  const normalizeList = (list: OptionInput[] | undefined, old: PricedOption[] | undefined, label: string, prefix: string) => {
    const out: PricedOption[] = [];
    const seen = new Set<string>();
    for (const raw of list ?? []) {
      const name = clean(raw.name ?? '');
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) throw new BadRequestException(`${label} "${name}" bị trùng tên`);
      seen.add(key);
      const kept =
        (raw.id && old?.find((o) => o.id === raw.id)) || old?.find((o) => o.name.trim().toLowerCase() === key);
      out.push({ id: kept ? kept.id : `${prefix}_${randomUUID().slice(0, 8)}`, name, price: Math.round(raw.price) });
    }
    return out.length ? out : undefined;
  };

  const normalizeLevels = (list: string[] | undefined) => {
    const out: string[] = [];
    for (const raw of list ?? []) {
      const v = clean(raw ?? '');
      if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    }
    return out.length ? out : undefined;
  };

  const sizes = normalizeList(input.sizes, prev.sizes, 'Size', 'size');
  const toppings = normalizeList(input.toppings, prev.toppings, 'Topping', 'top');
  const spiceLevels = normalizeLevels(input.spiceLevels);
  const sugarLevels = normalizeLevels(input.sugarLevels);

  if (spiceLevels && sugarLevels) {
    throw new BadRequestException('Mỗi món chỉ chọn một loại mức: mức cay hoặc mức đường');
  }

  const result: MenuOptions = {};
  if (sizes) result.sizes = sizes;
  if (toppings) result.toppings = toppings;
  if (spiceLevels) result.spiceLevels = spiceLevels;
  if (sugarLevels) result.sugarLevels = sugarLevels;
  return Object.keys(result).length ? result : null;
}
