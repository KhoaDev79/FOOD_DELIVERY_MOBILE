import { useAuthStore } from './useAuthStore';
import { useCartStore } from './useCartStore';
import { useDeliveryAddressStore } from './useDeliveryAddressStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      removeItem: async (k: string) => void mem.delete(k),
    },
  };
});

jest.mock('../utils/storage', () => {
  const mem = new Map<string, string>();
  return {
    appStorage: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      deleteItem: async (k: string) => void mem.delete(k),
    },
  };
});

jest.mock('../constants/config', () => ({ API_BASE_URL: 'http://test/api/v1' }));

jest.mock('axios',() => ({ __esModule: true, default: { post: jest.fn(() => Promise.resolve()) } }));

const menuItem = {
  id: 'm1',
  restaurantId: 'r1',
  name: 'Phở tái',
  price: 50000,
  isAvailable: true,
  isArchived: false,
} as never;

describe('useAuthStore.logout', () => {
  it('xoá giỏ hàng và địa chỉ giao đang chọn của tài khoản vừa đăng xuất', async () => {
    useCartStore.getState().addItem({ id: 'r1', name: 'Phở Thìn' } as never, menuItem, 2);
    useDeliveryAddressStore.setState({ selectedAddressId: 'addr-1' });
    useAuthStore.setState({ isAuthenticated: true, accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } as never });
    expect(useCartStore.getState().items).toHaveLength(1);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().restaurant).toBeNull();
    expect(useDeliveryAddressStore.getState().selectedAddressId).toBeNull();
  });

  it('giỏ thêm khi chưa đăng nhập vẫn giữ nguyên khi đăng nhập (để thanh toán tiếp)', async () => {
    useCartStore.getState().addItem({ id: 'r1', name: 'Phở Thìn' } as never, menuItem, 1);
    await useAuthStore.getState().setAuth({ id: 'u2', role: 'CUSTOMER', phone: '0912345678' } as never, 'a', 'r');
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
