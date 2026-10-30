import { useCartStore } from './useCartStore';

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

const quan = { id: 'r1', name: 'Phở Thìn' };
const pho = {
  id: 'm1',
  restaurantId: 'r1',
  name: 'Phở tái',
  price: 65000,
  discountPrice: 55000,
  isAvailable: true,
  isArchived: false,
  options: {
    sizes: [
      { id: 'thuong', name: 'Tô thường', price: 0 },
      { id: 'dac_biet', name: 'Tô đặc biệt', price: 15000 },
    ],
    toppings: [{ id: 'quay', name: 'Quẩy', price: 8000 }],
  },
};

describe('useCartStore – giá khớp backend', () => {
  beforeEach(() => useCartStore.setState({ restaurant: null, items: [] }));

  it('thêm nhanh dùng giá giảm và size mặc định', () => {
    useCartStore.getState().addItem(quan, pho, 2);
    expect(useCartStore.getState().getSubtotal()).toBe(55000 * 2);
  });

  it('thêm kèm tuỳ chọn: store tự tính đơn giá từ mã tuỳ chọn', () => {
    useCartStore.getState().addCustomItem(quan, pho, 1, { sizeId: 'dac_biet', toppingIds: ['quay'] });
    const line = useCartStore.getState().items[0];
    expect(line.unitPrice).toBe(55000 + 15000 + 8000);
    expect(line.sizeId).toBe('dac_biet');
  });

  it('thêm nhanh không gộp vào dòng có tuỳ chọn', () => {
    const s = useCartStore.getState();
    s.addCustomItem(quan, pho, 1, { sizeId: 'dac_biet' });
    s.addItem(quan, pho, 1);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('chặn món của quán khác', () => {
    useCartStore.getState().addItem(quan, pho, 1);
    expect(useCartStore.getState().addItem({ id: 'r2', name: 'Khác' }, { ...pho, id: 'm2' }, 1)).toBe(
      'DIFFERENT_RESTAURANT',
    );
  });

  it('cập nhật tuỳ chọn của món đã có trong giỏ', () => {
    useCartStore.getState().addItem(quan, pho, 1);
    const item = useCartStore.getState().items[0];
    expect(item.unitPrice).toBe(55000);

    useCartStore.getState().updateLineItem(item.id ?? item.menuItem.id, 2, {
      sizeId: 'dac_biet',
      size: 'Tô đặc biệt',
      toppingIds: ['quay'],
      toppings: ['Quẩy'],
      note: 'Ít bánh',
    });

    const updated = useCartStore.getState().items[0];
    expect(updated.quantity).toBe(2);
    expect(updated.sizeId).toBe('dac_biet');
    expect(updated.size).toBe('Tô đặc biệt');
    expect(updated.toppingIds).toEqual(['quay']);
    expect(updated.note).toBe('Ít bánh');
    expect(updated.unitPrice).toBe(55000 + 15000 + 8000);
    expect(useCartStore.getState().getSubtotal()).toBe((55000 + 15000 + 8000) * 2);
  });
});

describe('useCartStore – nâng cấp giỏ cũ (v1 → v2)', () => {
  it('bỏ tuỳ chọn viết cứng và tính lại giá thật', async () => {
    const migrate = (
      useCartStore as unknown as { persist: { getOptions: () => { migrate: Function } } }
    ).persist.getOptions().migrate;
    const old = {
      restaurant: quan,
      items: [{ id: 'm1-1', menuItem: pho, quantity: 1, size: 'M', toppings: ['Phô mai'], unitPrice: 85000 }],
    };
    const next = await migrate(old, 0);
    expect(next.items[0]).toEqual({ menuItem: pho, quantity: 1, note: undefined, unitPrice: 55000 });
  });
});
