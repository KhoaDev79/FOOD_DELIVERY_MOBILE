import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RESTAURANT_SELECT = {
  id: true,
  name: true,
  imageUrl: true,
  address: true,
  rating: true,
  isOpen: true,
} as const;

/** Quán yêu thích lưu theo từng tài khoản. */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      include: { restaurant: { select: RESTAURANT_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((f) => ({ ...f.restaurant, addedAt: f.createdAt }));
  }

  /** Thêm (idempotent): bấm nhiều lần không tạo bản ghi trùng. */
  async add(userId: string, restaurantId: string) {
    const exists = await this.prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Không tìm thấy quán');
    await this.prisma.favorite.upsert({
      where: { userId_restaurantId: { userId, restaurantId } },
      create: { userId, restaurantId },
      update: {},
    });
    return { restaurantId, isFavorite: true };
  }

  async remove(userId: string, restaurantId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, restaurantId } });
    return { restaurantId, isFavorite: false };
  }
}
