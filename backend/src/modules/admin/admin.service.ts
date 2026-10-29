import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { hashSecret } from '../../common/utils/password.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminCreateRestaurantDto,
  AdminUpdateRestaurantDto,
  ListAdminOrdersQueryDto,
  ListUsersQueryDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy danh sách toàn bộ người dùng hệ thống */
  async listUsers(q: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.q?.trim()
        ? {
            OR: [
              { fullName: { contains: q.q.trim(), mode: 'insensitive' } },
              { email: { contains: q.q.trim(), mode: 'insensitive' } },
              { phone: { contains: q.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      hasMore: q.page * q.limit < total,
    };
  }

  /** Khóa hoặc Mở khóa tài khoản */
  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: !user.isActive,
        // Nếu khóa tài khoản thì thu hồi luôn refresh token để đăng xuất ngay lập tức
        ...(!user.isActive ? {} : { refreshTokenHash: null }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    return updated;
  }

  /** Lấy danh sách toàn bộ nhà hàng trong hệ thống */
  async listRestaurants(page: number = 1, limit: number = 20, q?: string) {
    const where: Prisma.RestaurantWhereInput = q?.trim()
      ? { name: { contains: q.trim(), mode: 'insensitive' } }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: {
          owner: { select: { id: true, fullName: true, email: true, phone: true } },
          _count: { select: { menuItems: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** Bật / Tắt trạng thái mở cửa của quán từ quyền Admin */
  async toggleRestaurantOpen(restaurantId: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isOpen: !rest.isOpen },
    });
  }

  /** Lấy danh sách toàn bộ đơn hàng toàn sàn */
  async listOrders(q: ListAdminOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = q.status
      ? { status: q.status as any }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          restaurant: { select: { id: true, name: true } },
          driver: { select: { id: true, fullName: true, phone: true } },
          items: { select: { name: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      hasMore: q.page * q.limit < total,
    };
  }

  /** Thống kê số liệu bảng điều khiển Admin */
  async getDashboardStats() {
    const [
      totalUsers,
      usersByRole,
      totalRestaurants,
      openRestaurants,
      totalOrders,
      ordersByStatus,
      revenueResult,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.restaurant.count(),
      this.prisma.restaurant.count({ where: { isOpen: true } }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: 'DELIVERED' },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        roles: Object.fromEntries(usersByRole.map((r) => [r.role, r._count.id])),
      },
      restaurants: {
        total: totalRestaurants,
        open: openRestaurants,
        closed: totalRestaurants - openRestaurants,
      },
      orders: {
        total: totalOrders,
        statuses: Object.fromEntries(ordersByStatus.map((s) => [s.status, s._count.id])),
        totalRevenue: revenueResult._sum.total || 0,
      },
    };
  }

  /** Thêm nhà hàng mới cùng thông tin chủ quán */
  async createRestaurant(dto: AdminCreateRestaurantDto) {
    let owner = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.ownerEmail.toLowerCase().trim() },
          ...(dto.ownerPhone ? [{ phone: dto.ownerPhone.trim() }] : []),
        ],
      },
    });

    if (!owner) {
      const defaultPassword = 'Owner@' + Math.floor(100000 + Math.random() * 900000);
      const passwordHash = await hashSecret(defaultPassword);
      owner = await this.prisma.user.create({
        data: {
          fullName: dto.ownerName.trim(),
          email: dto.ownerEmail.toLowerCase().trim(),
          phone: dto.ownerPhone.trim(),
          passwordHash,
          role: Role.RESTAURANT_OWNER,
        },
      });
    } else if (owner.role !== Role.RESTAURANT_OWNER && owner.role !== Role.ADMIN) {
      owner = await this.prisma.user.update({
        where: { id: owner.id },
        data: { role: Role.RESTAURANT_OWNER },
      });
    }

    const restaurant = await this.prisma.restaurant.create({
      data: {
        ownerId: owner.id,
        name: dto.name.trim(),
        address: dto.address.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        imageUrl: dto.imageUrl?.trim() || null,
        isOpen: true,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    return restaurant;
  }

  /** Chỉnh sửa thông tin nhà hàng */
  async updateRestaurant(id: string, dto: AdminUpdateRestaurantDto) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.restaurant.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.address ? { address: dto.address.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isOpen !== undefined ? { isOpen: dto.isOpen } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
  }

  /** Xóa nhà hàng */
  async deleteRestaurant(id: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.restaurant.delete({ where: { id } });
  }

  /** Xóa món ăn khỏi hệ thống */
  async deleteMenuItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy món ăn');

    return this.prisma.menuItem.update({
      where: { id },
      data: { isArchived: true, isAvailable: false },
    });
  }
}

