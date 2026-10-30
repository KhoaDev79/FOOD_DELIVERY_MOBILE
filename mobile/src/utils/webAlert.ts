import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Trên web, Alert.alert của react-native-web không hiện gì và không gọi nút nào, nên mọi thao tác
 * cần xác nhận (đăng xuất, nhận đơn, huỷ đơn, xoá...) bị "đứng im". Hàm này thay Alert.alert trên web
 * bằng hộp thoại của trình duyệt:
 *  - 0–1 nút: window.alert rồi gọi nút đó (nếu có)
 *  - nhiều nút: window.confirm; OK = nút hành động cuối cùng (không phải "cancel"), Huỷ = nút cancel
 * Trên iOS/Android không thay đổi gì.
 */
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const actions = buttons.filter((b) => b !== cancel);
    const primary = actions[actions.length - 1];
    if (window.confirm(text)) primary?.onPress?.();
    else cancel?.onPress?.();
  };
}
