import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { checkCart, CartCheckLine, CartCheckResult } from './cart-check';

@Injectable()
export class CartCheckService {
  constructor(private readonly prisma: PrismaService) {}

  /** Đọc quán + các món trong giỏ rồi kiểm tra bằng hàm thuần checkCart. */
  async check(restaurantId: string, lines: CartCheckLine[], now = new Date()): Promise<CartCheckResult> {
    const ids = [...new Set(lines.map((l) => l.menuItemId))];
    const [restaurant, menuItems] = await Promise.all([
      this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          status: true,
          isOpen: true,
          openTime: true,
          closeTime: true,
          pausedUntil: true,
          openingHours: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
          specialClosings: { select: { date: true, reason: true } },
        },
      }),
      this.prisma.menuItem.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          restaurantId: true,
          price: true,
          discountPrice: true,
          options: true,
          isAvailable: true,
          isArchived: true,
          soldOutUntil: true,
          availableFrom: true,
          availableTo: true,
        },
      }),
    ]);
    return checkCart(restaurant, menuItems, lines, now);
  }
}
