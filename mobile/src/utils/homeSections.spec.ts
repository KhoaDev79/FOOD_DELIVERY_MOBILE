import { Restaurant } from '../types/api';
import { filterRestaurants, pickFeatured, sortByDistance } from './homeSections';

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

describe('sortByDistance', () => {
  it('sắp theo khoảng cách, quán thiếu khoảng cách xuống cuối', () => {
    expect(sortByDistance([make('a', 5, 3), make('b', 4, 1), make('c', 3)]).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('loại bản ghi trùng id từ API', () => {
    const ids = sortByDistance([make('1', 4, 2), make('2', 4, 1), make('1', 4, 2)]).map((r) => r.id);
    expect(ids).toEqual(['2', '1']);
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

describe('pickFeatured', () => {
  const list = [make('a', 4.2, 1), make('b', 4.9, 3), make('c', 0, 0.5), make('d', 4.9, 2), make('e', 4.5, 4)];
  it('lấy quán điểm cao nhất, hoà điểm thì quán gần hơn trước, bỏ quán chưa có điểm', () => {
    expect(pickFeatured(list, 3).featured.map((r) => r.id)).toEqual(['d', 'b', 'e']);
  });
  it('phần còn lại không chứa quán đã chọn và giữ thứ tự ban đầu', () => {
    const { featured, rest } = pickFeatured(list, 3);
    expect(rest.map((r) => r.id)).toEqual(['a', 'c']);
    expect(rest.some((r) => featured.includes(r))).toBe(false);
  });
});
