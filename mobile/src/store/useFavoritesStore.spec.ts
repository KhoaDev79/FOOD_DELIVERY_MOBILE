// jest.mock được Jest đưa lên trước mọi import, nên import có thể đặt ở đầu file.
import { useFavoritesStore } from './useFavoritesStore';

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


const quan = { id: 'r1', name: 'Phở Thìn', imageUrl: null, address: '13 Lò Đúc', rating: 4.8 };

describe('useFavoritesStore', () => {
  beforeEach(() => useFavoritesStore.setState({ restaurants: [] }));

  it('bấm lần đầu thì thêm, bấm lần hai thì bỏ', () => {
    expect(useFavoritesStore.getState().toggle(quan)).toBe(true);
    expect(useFavoritesStore.getState().isFavorite('r1')).toBe(true);
    expect(useFavoritesStore.getState().toggle(quan)).toBe(false);
    expect(useFavoritesStore.getState().restaurants).toHaveLength(0);
  });

  it('quán mới thích nằm đầu danh sách và không bị trùng', () => {
    const s = useFavoritesStore.getState();
    s.toggle(quan);
    s.toggle({ ...quan, id: 'r2', name: 'Bún Chả' });
    const ids = useFavoritesStore.getState().restaurants.map((r) => r.id);
    expect(ids).toEqual(['r2', 'r1']);
  });

  it('remove chỉ xoá đúng quán', () => {
    const s = useFavoritesStore.getState();
    s.toggle(quan);
    s.toggle({ ...quan, id: 'r2' });
    s.remove('r1');
    expect(useFavoritesStore.getState().restaurants.map((r) => r.id)).toEqual(['r2']);
  });
});
