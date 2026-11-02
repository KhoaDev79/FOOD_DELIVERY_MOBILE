import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_CUISINE_CATEGORIES = [
  {
    code: 'bun-pho',
    name: 'Bún - Phở',
    keywords: ['bún', 'phở', 'hủ tiếu', 'mì'],
    imageUrl: '/public/images/food/pho.jpg',
    sortOrder: 1,
  },
  {
    code: 'com',
    name: 'Cơm',
    keywords: ['cơm'],
    imageUrl: '/public/images/food/comtam.jpg',
    sortOrder: 2,
  },
  {
    code: 'tra-sua',
    name: 'Trà sữa - Cà phê',
    keywords: ['trà', 'cà phê', 'coffee', 'cafe'],
    imageUrl: '/public/images/food/trasua.jpg',
    sortOrder: 3,
  },
  {
    code: 'banh-mi',
    name: 'Bánh mì',
    keywords: ['bánh mì'],
    imageUrl: '/public/images/food/banhmi.jpg',
    sortOrder: 4,
  },
  {
    code: 'ga-ran',
    name: 'Gà rán',
    keywords: ['gà rán', 'gà'],
    imageUrl: '/public/images/food/garan.jpg',
    sortOrder: 5,
  },
  {
    code: 'lau',
    name: 'Lẩu',
    keywords: ['lẩu'],
    imageUrl: '/public/images/food/lau.jpg',
    sortOrder: 6,
  },
  {
    code: 'do-ngot',
    name: 'Chè - Đồ ngọt',
    keywords: ['chè', 'kem', 'bánh', 'trái cây'],
    imageUrl: '/public/images/food/che.jpg',
    sortOrder: 7,
  },
];

@Controller('cuisines')
export class CuisinesController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /cuisines – danh mục ẩm thực hệ thống đang kích hoạt cho trang chủ */
  @Public()
  @Get()
  async list() {
    try {
      const items = await this.prisma.cuisineCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          imageUrl: true,
          sortOrder: true,
          keywords: true,
        },
      });

      if (items.length > 0) return items;
      // Bảng đã có dữ liệu nhưng quản trị viên tắt hết: tôn trọng, không hiện danh mục mặc định
      if ((await this.prisma.cuisineCategory.count()) > 0) return [];
    } catch {
      // Nếu DB chưa có bảng hoặc lỗi kết nối, trả về danh mục mặc định
    }

    return DEFAULT_CUISINE_CATEGORIES.map((c, idx) => ({
      id: `default-${c.code}`,
      ...c,
      sortOrder: idx + 1,
    }));
  }
}

