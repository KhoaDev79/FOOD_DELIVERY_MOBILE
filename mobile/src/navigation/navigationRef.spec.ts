import { handleUnhandledNavigationAction, navigationRef } from './navigationRef';

// jest.mock được Jest tự đưa lên trước các import khi chạy
// Môi trường test không biên dịch thư viện React Navigation: giả lập ref điều hướng (chỉ cần các hàm được dùng)
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => false,
    getRootState: () => undefined,
    navigate: () => undefined,
    getCurrentRoute: () => undefined,
  }),
}));

// Biến có sẵn khi chạy app (React Native), môi trường test không có
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

describe('handleUnhandledNavigationAction', () => {
  const setup = (routeNames: string[], current: string) => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    jest
      .spyOn(navigationRef, 'getRootState')
      .mockReturnValue({ routeNames, index: 0, routes: [{ name: current }] } as never);
    return jest.spyOn(navigationRef, 'navigate').mockImplementation(() => undefined);
  };
  afterEach(() => jest.restoreAllMocks());

  it('"quay lại" khi không còn màn phía sau: về màn chính của vai trò', () => {
    const nav = setup(['OwnerTabs', 'OwnerStats', 'Chat'], 'Chat');
    handleUnhandledNavigationAction({ type: 'GO_BACK' });
    expect(nav).toHaveBeenCalledWith('OwnerTabs');
  });

  it('đang ở màn chính rồi (bấm quay lại 2 lần): không làm gì', () => {
    const nav = setup(['MainTabs', 'Search'], 'MainTabs');
    handleUnhandledNavigationAction({ type: 'GO_BACK' });
    expect(nav).not.toHaveBeenCalled();
  });

  it('lệnh khác không xử lý được: vẫn báo lỗi khi phát triển, không tự điều hướng', () => {
    const nav = setup(['DriverTabs'], 'DriverTabs');
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    handleUnhandledNavigationAction({ type: 'NAVIGATE', payload: { name: 'KhongTonTai' } });
    expect(nav).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });
});
