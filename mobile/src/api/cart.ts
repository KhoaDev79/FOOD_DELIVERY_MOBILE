import { apiClient } from './client';

export interface CartCheckItemPayload {
  lineKey: string;
  menuItemId: string;
  quantity: number;
  sizeId?: string;
  toppingIds?: string[];
  level?: string;
  unitPrice?: number;
}

export type CartLineStatus = 'OK' | 'SOLD_OUT' | 'REMOVED' | 'OUT_OF_HOURS' | 'OPTION_CHANGED' | 'PRICE_CHANGED';
export type CartRestaurantStatus = 'OPEN' | 'CLOSED' | 'PAUSED' | 'OUTSIDE_HOURS' | 'HOLIDAY' | 'INACTIVE';

export interface CartLineCheck {
  lineKey: string;
  menuItemId: string;
  status: CartLineStatus;
  message: string | null;
  blocking: boolean;
  unitPrice: number | null;
  previousUnitPrice?: number;
  soldOutUntil?: string | null;
}

export interface CartCheckResult {
  restaurant: { id: string; status: CartRestaurantStatus; message: string | null; pausedUntil?: string | null };
  lines: CartLineCheck[];
  canCheckout: boolean;
  issueCount: number;
}

export const cartApi = {
  /** Kiểm tra giỏ với máy chủ: món hết / ngoài giờ / đổi giá / bị xoá, quán còn nhận đơn không. */
  check: (restaurantId: string, items: CartCheckItemPayload[]) =>
    apiClient.post<any, CartCheckResult>('/cart/check', { restaurantId, items }),
};
