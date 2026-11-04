import {
  isRestaurantPaused,
  isSpecialClosing,
  isWithinWeeklySchedule,
  SpecialClosingInput,
  WeeklyOpeningHourInput,
} from '../../common/utils/opening-hours';
import { isDishWithinServingHours } from '../../common/utils/dish-availability.util';
import { formatRestockTime } from '../menus/menu-stock.util';
import { LineSelection, OrderPricingError, priceOrderLine, PricingMenuItem } from './order-pricing';

/**
 * Kiểm tra giỏ hàng (lưu trên máy khách) với dữ liệu thật trên máy chủ, giống cách GrabFood / ShopeeFood
 * kiểm tra khi mở giỏ và trước khi thanh toán: báo từng món hết / ngoài giờ bán / đổi giá / đã bị xoá,
 * và quán còn nhận đơn không. Hàm thuần để dễ test; service lo phần đọc DB.
 */

export interface CartCheckLine extends LineSelection {
  /** Mã dòng trong giỏ (app tự đặt) để app biết dòng nào có vấn đề */
  lineKey: string;
  menuItemId: string;
  quantity: number;
  /** Đơn giá app đang hiển thị; khác giá mới thì báo PRICE_CHANGED */
  unitPrice?: number;
}

export interface CartCheckMenuItem extends PricingMenuItem {
  id: string;
  name: string;
  restaurantId: string;
  isAvailable: boolean;
  isArchived: boolean;
  soldOutUntil: Date | null;
  availableFrom: string | null;
  availableTo: string | null;
}

export interface CartCheckRestaurant {
  id: string;
  name: string;
  status: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  pausedUntil: Date | null;
  openingHours?: WeeklyOpeningHourInput[] | null;
  specialClosings?: SpecialClosingInput[] | null;
}

export type CartLineStatus = 'OK' | 'SOLD_OUT' | 'REMOVED' | 'OUT_OF_HOURS' | 'OPTION_CHANGED' | 'PRICE_CHANGED';
export type CartRestaurantStatus = 'OPEN' | 'CLOSED' | 'PAUSED' | 'OUTSIDE_HOURS' | 'HOLIDAY' | 'INACTIVE';

export interface CartLineResult {
  lineKey: string;
  menuItemId: string;
  status: CartLineStatus;
  /** Câu báo ngắn hiển thị dưới món (null khi OK) */
  message: string | null;
  /** Món phải bỏ khỏi giỏ mới đặt được (hết, bị xoá, ngoài giờ, tuỳ chọn không còn) */
  blocking: boolean;
  unitPrice: number | null;
  previousUnitPrice?: number;
  soldOutUntil?: string | null;
}

export interface CartCheckResult {
  restaurant: { id: string; status: CartRestaurantStatus; message: string | null; pausedUntil?: string | null };
  lines: CartLineResult[];
  /** Có điều gì chặn đặt đơn không (quán không nhận đơn hoặc có món phải bỏ) */
  canCheckout: boolean;
  /** Số dòng cần xử lý (chặn + đổi giá) */
  issueCount: number;
}

function restaurantStatus(r: CartCheckRestaurant | null, now: Date): CartCheckResult['restaurant'] {
  if (!r || r.status !== 'ACTIVE') {
    return { id: r?.id ?? '', status: 'INACTIVE', message: 'Quán hiện ngừng hoạt động trên ZomZom.' };
  }
  if (!r.isOpen) return { id: r.id, status: 'CLOSED', message: 'Quán đang đóng cửa.' };
  if (isRestaurantPaused(r.pausedUntil, now)) {
    return {
      id: r.id,
      status: 'PAUSED',
      message: `Quán tạm nghỉ, mở lại lúc ${formatRestockTime(r.pausedUntil!, now).replace(' sáng mai', ' ngày mai')}.`,
      pausedUntil: r.pausedUntil!.toISOString(),
    };
  }
  const holiday = isSpecialClosing(r.specialClosings, now);
  if (holiday.isClosing) {
    return { id: r.id, status: 'HOLIDAY', message: `Quán nghỉ hôm nay${holiday.reason ? ` (${holiday.reason})` : ''}.` };
  }
  if (!isWithinWeeklySchedule(r, now)) {
    return { id: r.id, status: 'OUTSIDE_HOURS', message: 'Quán đã ngoài giờ nhận đơn. Bạn có thể đặt lại khi quán mở cửa.' };
  }
  return { id: r.id, status: 'OPEN', message: null };
}

function checkLine(line: CartCheckLine, m: CartCheckMenuItem | undefined, restaurantId: string, now: Date): CartLineResult {
  const base = { lineKey: line.lineKey, menuItemId: line.menuItemId };
  if (!m || m.isArchived || m.restaurantId !== restaurantId) {
    return { ...base, status: 'REMOVED', message: 'Món không còn trong thực đơn của quán.', blocking: true, unitPrice: null };
  }
  if (!m.isAvailable) {
    const until = m.soldOutUntil && m.soldOutUntil.getTime() > now.getTime() ? m.soldOutUntil : null;
    return {
      ...base,
      status: 'SOLD_OUT',
      message: until ? `Hết hôm nay, mở bán lại ${formatRestockTime(until, now)}.` : 'Món tạm hết.',
      blocking: true,
      unitPrice: null,
      soldOutUntil: until?.toISOString() ?? null,
    };
  }
  if (!isDishWithinServingHours(m.availableFrom, m.availableTo, now)) {
    return {
      ...base,
      status: 'OUT_OF_HOURS',
      message: `Chỉ bán ${m.availableFrom} – ${m.availableTo}.`,
      blocking: true,
      unitPrice: null,
    };
  }
  let unitPrice: number;
  try {
    unitPrice = priceOrderLine(m, line).unitPrice;
  } catch (e) {
    if (!(e instanceof OrderPricingError)) throw e;
    return { ...base, status: 'OPTION_CHANGED', message: 'Tuỳ chọn của món đã thay đổi, vui lòng chọn lại.', blocking: true, unitPrice: null };
  }
  if (line.unitPrice !== undefined && line.unitPrice !== unitPrice) {
    const up = unitPrice > line.unitPrice;
    return {
      ...base,
      status: 'PRICE_CHANGED',
      message: up ? 'Giá món vừa tăng.' : 'Giá món vừa giảm.',
      blocking: false,
      unitPrice,
      previousUnitPrice: line.unitPrice,
    };
  }
  return { ...base, status: 'OK', message: null, blocking: false, unitPrice };
}

export function checkCart(
  restaurant: CartCheckRestaurant | null,
  menuItems: CartCheckMenuItem[],
  lines: CartCheckLine[],
  now: Date,
): CartCheckResult {
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const r = restaurantStatus(restaurant, now);
  const results = lines.map((l) => checkLine(l, byId.get(l.menuItemId), restaurant?.id ?? '', now));
  const blocking = results.some((l) => l.blocking);
  return {
    restaurant: r,
    lines: results,
    canCheckout: r.status === 'OPEN' && !blocking && results.length > 0,
    issueCount: results.filter((l) => l.status !== 'OK').length,
  };
}
