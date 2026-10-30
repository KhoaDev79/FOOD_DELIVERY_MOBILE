/**
 * Lối tắt danh mục trên trang chủ. Đây KHÔNG phải dữ liệu từ API: chạm vào chỉ lọc
 * danh sách quán theo từ khoá trong tên/mô tả. Ảnh là ảnh cục bộ của backend
 * (backend/public/images/food, giấy phép Unsplash – xem SOURCES.md).
 */
export interface HomeCategory {
  id: string;
  label: string;
  keywords: string[];
  image: string;
}

export const HOME_CATEGORIES: HomeCategory[] = [
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
