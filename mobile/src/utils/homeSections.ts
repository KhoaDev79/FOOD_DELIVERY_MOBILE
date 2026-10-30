import { Restaurant } from '../types/api';

/** Sắp quán theo khoảng cách (quán thiếu khoảng cách xuống cuối) và bỏ bản ghi trùng id. */
export function sortByDistance(restaurants: Restaurant[]): Restaurant[] {
  return Array.from(new Map(restaurants.map((r) => [r.id, r])).values()).sort(
    (x, y) => (x.distanceKm ?? Number.POSITIVE_INFINITY) - (y.distanceKm ?? Number.POSITIVE_INFINITY),
  );
}

/** Lọc theo từ khoá tìm kiếm hoặc danh mục (khớp bất kỳ từ khoá nào trong tên hoặc mô tả). */
export function filterRestaurants(restaurants: Restaurant[], query: string, keywords: string[] = []): Restaurant[] {
  const norm = (s: string) => s.toLocaleLowerCase('vi-VN').trim();
  const terms = [query, ...keywords].map(norm).filter(Boolean);
  if (terms.length === 0) return restaurants;
  return restaurants.filter((r) => {
    const hay = norm(`${r.name} ${r.description ?? ''}`);
    return query.trim() ? hay.includes(norm(query)) : terms.some((t) => hay.includes(t));
  });
}
