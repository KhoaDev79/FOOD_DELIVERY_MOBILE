import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Restaurant } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { boundingBox } from '../../common/utils/geo.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRestaurantDto,
  NearbyRestaurantsQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurants.dto';

export interface NearbyRestaurant {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  isOpen: boolean;
  rating: number;
  distanceKm: number;
}

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tìm quán quanh vị trí người dùng:
   *  1. Lọc thô bằng bounding box (tận dụng index latitude/longitude)
   *  2. Tính Haversine chính xác trong SQL
   *  3. Chỉ giữ quán nằm trong bán kính tìm kiếm VÀ trong bán kính giao hàng của chính quán đó
   */
  async findNearby(query: NearbyRestaurantsQueryDto) {
    const { lat, lng, radiusKm, q, openOnly, page, limit } = query;
    const box = boundingBox({ lat, lng }, radiusKm);
    const offset = (page - 1) * limit;

    const filters: Prisma.Sql[] = [
      Prisma.sql`r.latitude BETWEEN ${box.minLat} AND ${box.maxLat}`,
      Prisma.sql`r.longitude BETWEEN ${box.minLng} AND ${box.maxLng}`,
    ];
    if (q?.trim()) filters.push(Prisma.sql`r.name ILIKE ${'%' + q.trim() + '%'}`);
    if (openOnly) filters.push(Prisma.sql`r."isOpen" = true`);

    const rows = await this.prisma.$queryRaw<NearbyRestaurant[]>`
      SELECT * FROM (
        SELECT
          r.id, r.name, r.description, r."imageUrl", r.address,
          r.latitude, r.longitude, r."deliveryRadiusKm", r."isOpen", r.rating,
          2 * 6371 * ASIN(LEAST(1, SQRT(
            POWER(SIN(RADIANS(r.latitude - ${lat}) / 2), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(r.latitude)) *
            POWER(SIN(RADIANS(r.longitude - ${lng}) / 2), 2)
          ))) AS "distanceKm"
        FROM restaurants r
        WHERE ${Prisma.join(filters, ' AND ')}
      ) AS candidates
      WHERE "distanceKm" <= ${radiusKm} AND "distanceKm" <= "deliveryRadiusKm"
      ORDER BY "isOpen" DESC, "distanceKm" ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => ({
      ...r,
      distanceKm: Math.round(Number(r.distanceKm) * 100) / 100,
    }));

    if (items.length === 0 && page === 1) {
      // Tự động mở rộng bán kính: hiển thị các quán gần vị trí người dùng nhất thay vì danh sách rỗng
      const nearestRows = await this.prisma.$queryRaw<NearbyRestaurant[]>`
        SELECT
          r.id, r.name, r.description, r."imageUrl", r.address,
          r.latitude, r.longitude, r."deliveryRadiusKm", r."isOpen", r.rating,
          2 * 6371 * ASIN(LEAST(1, SQRT(
            POWER(SIN(RADIANS(r.latitude - ${lat}) / 2), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(r.latitude)) *
            POWER(SIN(RADIANS(r.longitude - ${lng}) / 2), 2)
          ))) AS "distanceKm"
        FROM restaurants r
        WHERE r."isOpen" = true
        ORDER BY "distanceKm" ASC
        LIMIT 6
      `;

      if (nearestRows.length > 0) {
        return {
          items: nearestRows.map((r) => ({
            ...r,
            distanceKm: Math.round(Number(r.distanceKm) * 100) / 100,
          })),
          page,
          limit,
          hasMore: false,
          isExpandedRadius: true,
          notice: 'Không có quán nào trong bán kính tiêu chuẩn. Đang hiển thị các quán gần vị trí của bạn nhất.',
        };
      }
    }

    return { items, page, limit, hasMore, isExpandedRadius: false };
  }

  async findOneWithMenu(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: { where: { isArchived: false }, orderBy: { name: 'asc' } },
          },
        },
        // Món chưa gán danh mục
        menuItems: { where: { isArchived: false, categoryId: null }, orderBy: { name: 'asc' } },
      },
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
    const { menuItems: uncategorized, ...rest } = restaurant;
    return { ...rest, uncategorizedItems: uncategorized };
  }

  findMine(ownerId: string) {
    return this.prisma.restaurant.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
  }

  create(ownerId: string, dto: CreateRestaurantDto) {
    const { ownerId: _ignored, ...data } = dto;
    return this.prisma.restaurant.create({ data: { ...data, ownerId } });
  }

  async update(id: string, user: AuthUser, dto: UpdateRestaurantDto) {
    await this.assertCanManage(id, user);
    return this.prisma.restaurant.update({ where: { id }, data: dto });
  }

  async delete(id: string, user: AuthUser) {
    await this.assertCanManage(id, user);
    return this.prisma.restaurant.delete({ where: { id } });
  }

  /** Chỉ chủ quán hoặc ADMIN được quản lý nhà hàng. Dùng lại ở Menus & Orders. */
  async assertCanManage(restaurantId: string, user: AuthUser): Promise<Restaurant> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
    if (user.role !== 'ADMIN' && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không phải chủ nhà hàng này');
    }
    return restaurant;
  }
}
