import { StackActions } from '@react-navigation/native';

const AUTH_SCREENS = new Set(['Login', 'Register']);

interface StackNavigationLike {
  getState: () => { routes: { name: string }[] } | undefined;
  dispatch: (action: ReturnType<typeof StackActions.pop>) => void;
  navigate: (...args: any[]) => void;
}

/**
 * Sau khi đăng nhập/đăng ký thành công: đóng TẤT CẢ màn Đăng nhập/Đăng ký đang mở và quay về
 * đúng màn người dùng đang xem trước đó (Trang chủ, Giỏ hàng, Thanh toán...).
 * Trước đây dùng goBack(): đi Đăng nhập → Đăng ký rồi đăng ký xong sẽ quay về màn Đăng nhập
 * trong khi đã đăng nhập rồi.
 */
export function leaveAuthScreens(navigation: StackNavigationLike) {
  const routes = navigation.getState()?.routes ?? [];
  const firstAuth = routes.findIndex((r) => AUTH_SCREENS.has(r.name));
  if (firstAuth > 0) {
    navigation.dispatch(StackActions.pop(routes.length - firstAuth));
  } else {
    navigation.navigate('MainTabs', { screen: 'HomeTab' });
  }
}
