import { formatVND } from './format';

/**
 * Link chia sẻ https ngắn do backend phục vụ (/s/r/:id, /s/d/:id): bấm được trong Zalo/Messenger
 * và hiện thẻ xem trước có ảnh. Link fooddelivery:// thì các app chat không cho bấm.
 * `origin` = gốc máy chủ API (không có /api/v1).
 */
export function restaurantShareUrl(origin: string, restaurantId: string): string {
  return `${origin.replace(/\/+$/, '')}/s/r/${restaurantId}`;
}

export function dishShareUrl(origin: string, dishId: string): string {
  return `${origin.replace(/\/+$/, '')}/s/d/${dishId}`;
}

/** Lời nhắn kèm link khi chia sẻ quán: tên, sao (nếu có), địa chỉ. */
export function restaurantShareMessage(
  r: { name: string; rating?: number | null; ratingCount?: number | null; address?: string | null },
  url: string,
): string {
  const stars = r.rating && (r.ratingCount ?? 0) > 0 ? ` ⭐ ${r.rating.toFixed(1)}` : '';
  const address = r.address ? `\n📍 ${r.address}` : '';
  return `${r.name}${stars}${address}\nĐặt món trên ZomZom: ${url}`;
}

/** Lời nhắn khi chia sẻ món: tên món, giá đang bán, tên quán. */
export function dishShareMessage(
  item: { name: string; price: number; discountPrice?: number | null },
  restaurantName: string,
  url: string,
): string {
  const hasDeal = item.discountPrice !== null && item.discountPrice !== undefined && item.discountPrice < item.price;
  const price = hasDeal ? `${formatVND(item.discountPrice)} (giá gốc ${formatVND(item.price)})` : formatVND(item.price);
  return `${item.name} – ${price}\ntại ${restaurantName}\nĐặt món trên ZomZom: ${url}`;
}
