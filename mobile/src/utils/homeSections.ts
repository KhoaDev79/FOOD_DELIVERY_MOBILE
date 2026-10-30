import { Restaurant } from '../types/api';

export interface HomeSections {
  /** Đánh giá cao nhất (chỉ quán có điểm > 0). */
  topRated: Restaurant[];
  /** Gần nhất trong số còn lại. */
  nearest: Restaurant[];
  /** Phần còn lại, sắp theo khoảng cách. */
  rest: Restaurant[];
}

const byDistance = (a: Restaurant, b: Restaurant) =>
  (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);

/**
 * Chia danh sách quán thành các khối của trang chủ, bảo đảm
 * mỗi quán chỉ xuất hiện một lần trong cùng một cuộn.
 * Khi có ít quán, bỏ các khối ngang và đưa hết vào danh sách.
 */
export function buildHomeSections(restaurants: Restaurant[], railSize = 6): HomeSections {
  const unique = Array.from(new Map(restaurants.map((r) => [r.id, r])).values());
  if (unique.length < railSize + 2) {
    return { topRated: [], nearest: [], rest: [...unique].sort(byDistance) };
  }

  const used = new Set<string>();
  const topRated = unique
    .filter((r) => r.rating > 0)
    .sort((a, b) => b.rating - a.rating || byDistance(a, b))
    .slice(0, railSize);
  topRated.forEach((r) => used.add(r.id));

  const remaining = unique.filter((r) => !used.has(r.id)).sort(byDistance);
  const nearest = remaining.length >= railSize + 2 ? remaining.slice(0, railSize) : [];
  nearest.forEach((r) => used.add(r.id));

  return { topRated, nearest, rest: remaining.filter((r) => !used.has(r.id)) };
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
