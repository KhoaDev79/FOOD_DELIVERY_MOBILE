import { Restaurant } from '../types/api';
import { buildHomeSections, filterRestaurants } from './homeSections';

const make = (id: string, rating: number, distanceKm?: number, name = `Quán ${id}`): Restaurant => ({
  id,
  name,
  address: 'x',
  latitude: 0,
  longitude: 0,
  deliveryRadiusKm: 5,
  isOpen: true,
  rating,
  distanceKm,
});

describe('buildHomeSections', () => {
  it('không quán nào xuất hiện hai lần giữa các khối', () => {
    const list = Array.from({ length: 20 }, (_, i) => make(String(i), (i % 5) + 1, i * 0.3));
    const s = buildHomeSections(list);
    const ids = [...s.topRated, ...s.nearest, ...s.rest].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(20);
    expect(s.topRated).toHaveLength(6);
    expect(s.nearest).toHaveLength(6);
  });

  it('loại bản ghi trùng id từ API', () => {
    const list = [...Array.from({ length: 10 }, (_, i) => make(String(i), 4, i)), make('3', 4, 3)];
    const s = buildHomeSections(list);
    const ids = [...s.topRated, ...s.nearest, ...s.rest].map((r) => r.id);
    expect(ids.filter((x) => x === '3')).toHaveLength(1);
  });

  it('ít quán thì chỉ có danh sách, sắp theo khoảng cách', () => {
    const s = buildHomeSections([make('a', 5, 3), make('b', 4, 1), make('c', 3)]);
    expect(s.topRated).toHaveLength(0);
    expect(s.nearest).toHaveLength(0);
    expect(s.rest.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('khối đánh giá cao bỏ qua quán chưa có điểm', () => {
    const list = Array.from({ length: 12 }, (_, i) => make(String(i), i < 3 ? 4.5 : 0, i));
    expect(buildHomeSections(list).topRated.map((r) => r.id)).toEqual(['0', '1', '2']);
  });
});

describe('filterRestaurants', () => {
  const list = [make('1', 4, 1, 'Phở Thìn'), make('2', 4, 1, 'Bún bò Huế O Xuân'), make('3', 4, 1, 'Cơm tấm Cali')];
  it('lọc theo từ khoá, không phân biệt hoa thường', () => {
    expect(filterRestaurants(list, 'PHỞ').map((r) => r.id)).toEqual(['1']);
  });
  it('lọc theo danh mục khớp bất kỳ từ khoá nào', () => {
    expect(filterRestaurants(list, '', ['phở', 'bún']).map((r) => r.id)).toEqual(['1', '2']);
  });
  it('không lọc khi trống', () => {
    expect(filterRestaurants(list, '  ')).toHaveLength(3);
  });
});
