import { createNavigationContainerRef } from '@react-navigation/native';
import type { ChatChannel } from '../types/api';

/**
 * Ref điều hướng dùng chung cho những nơi nằm ngoài các màn hình (thông báo nổi, push).
 * Gắn vào <NavigationContainer ref={navigationRef} onReady={markNavigationReady}> ở App.tsx.
 */
export const navigationRef = createNavigationContainerRef<any>();

let ready = false;
const readyListeners = new Set<() => void>();
let pendingAction: (() => void) | null = null;

/** Gọi từ NavigationContainer.onReady: lúc này đã qua màn splash và có navigator thật. */
export function markNavigationReady() {
  ready = true;
  readyListeners.forEach((l) => l());
  if (pendingAction) {
    const action = pendingAction;
    pendingAction = null;
    action();
  }
}

export function isNavigationReady() {
  return ready && navigationRef.isReady();
}

export function subscribeNavigationReady(listener: () => void) {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

export interface ChatRouteParams {
  orderId: string;
  /** Cuộc trò chuyện 2 bên trong đơn (khách–tài xế, khách–quán, quán–tài xế). */
  channel: ChatChannel;
  recipientName?: string;
  recipientRole?: string;
}

/** Màn Chat có trong stack của khách, chủ quán và tài xế, nên điều hướng theo tên là đủ. */
export function openChat(params: ChatRouteParams) {
  const go = () => navigationRef.navigate('Chat', params);
  if (isNavigationReady()) go();
  else pendingAction = go;
}

/** Đang mở đúng cuộc trò chuyện này không (để không báo trùng tin đang đọc). */
export function isViewingChat(orderId: string, channel: ChatChannel): boolean {
  if (!navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute();
  const params = route?.params as ChatRouteParams | undefined;
  return route?.name === 'Chat' && params?.orderId === orderId && params?.channel === channel;
}
