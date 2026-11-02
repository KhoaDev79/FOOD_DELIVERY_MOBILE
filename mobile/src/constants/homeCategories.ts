import { CuisineCategory } from '../types/api';

/**
 * Lối tắt danh mục ẩm thực trên trang chủ (lấy động từ GET /cuisines,
 * fallback về danh sách mặc định nếu mạng offline hoặc đang tải).
 */
export interface HomeCategory {
  id: string;
  label: string;
  keywords: string[];
  image: string;
}

export const DEFAULT_HOME_CATEGORIES: HomeCategory[] = [
  {
    id: 'bun-pho',
    label: 'Bún - Phở',
    keywords: ['bún', 'phở', 'hủ tiếu', 'mì'],
    image: '/public/images/food/pho.jpg',
  },
  { id: 'com', label: 'Cơm', keywords: ['cơm'], image: '/public/images/food/comtam.jpg' },
  {
    id: 'tra-sua',
    label: 'Trà sữa - Cà phê',
    keywords: ['trà', 'cà phê', 'coffee', 'cafe'],
    image: '/public/images/food/trasua.jpg',
  },
  { id: 'banh-mi', label: 'Bánh mì', keywords: ['bánh mì'], image: '/public/images/food/banhmi.jpg' },
  { id: 'ga-ran', label: 'Gà rán', keywords: ['gà rán', 'gà'], image: '/public/images/food/garan.jpg' },
  { id: 'lau', label: 'Lẩu', keywords: ['lẩu'], image: '/public/images/food/lau.jpg' },
  {
    id: 'do-ngot',
    label: 'Chè - Đồ ngọt',
    keywords: ['chè', 'kem', 'bánh', 'trái cây'],
    image: '/public/images/food/che.jpg',
  },
];

/**
 * Chuyển đổi dữ liệu CuisineCategory từ API backend thành định dạng hiển thị HomeCategory
 */
export function mapCuisinesToHomeCategories(items?: CuisineCategory[]): HomeCategory[] {
  // Chỉ dùng danh mục mặc định khi chưa tải được dữ liệu; danh sách rỗng nghĩa là quản trị viên đã tắt hết
  if (!items) return DEFAULT_HOME_CATEGORIES;
  return items.map((item) => ({
    id: item.code || item.id,
    label: item.name,
    keywords: item.keywords && item.keywords.length > 0 ? item.keywords : [item.name.toLowerCase()],
    image: item.imageUrl,
  }));
}

export const HOME_CATEGORIES = DEFAULT_HOME_CATEGORIES;
