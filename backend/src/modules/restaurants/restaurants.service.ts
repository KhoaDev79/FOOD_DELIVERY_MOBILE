import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Restaurant, RestaurantStatus, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { boundingBox, calcDeliveryFee, estimateDelivery, haversineKm } from '../../common/utils/geo.util';
import { isAcceptingOrders } from '../../common/utils/opening-hours';
import { foldVietnamese, VI_ACCENTED, VI_PLAIN } from '../../common/utils/vietnamese';
import { BusinessConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRestaurantDto,
  NearbyRestaurantsQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurants.dto';
import { buildRestaurantStats, StatsRange, statsRangeStart } from './restaurant-stats';

export interface NearbyRestaurant {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  status: RestaurantStatus;
  isOpen: boolean;
  rating: number;
  ratingCount: number;
  /** Giờ mở/đóng cửa dạng "HH:mm" (bổ sung cho trang chủ). */
  openTime: string;
  closeTime: string;
  distanceKm: number;
}

/** Phạm vi tối đa khi khách tìm theo từ khoá (km): quán xa hơn coi như không liên quan. */
const SEARCH_MAX_KM = 50;

const RESTAURANT_COLUMNS = Prisma.sql`
  r.id, r.name, r.description, r."imageUrl", r.phone, r.address,
  r.latitude, r.longitude, r."deliveryRadiusKm", r.status, r."isOpen", r.rating, r."ratingCount", r."openTime", r."closeTime"`;

/** Biểu thức SQL bỏ dấu + viết thường, khớp với foldVietnamese() ở JS. */
const fold = (col: Prisma.Sql) => Prisma.sql`lower(translate(${col}, ${VI_ACCENTED}, ${VI_PLAIN}))`;

/** Khoảng cách Haversine (km) từ (lat, lng) tới quán r, tính trong SQL. */
const distanceSql = (lat: number, lng: number) => Prisma.sql`
  2 * 6371 * ASIN(LEAST(1, SQRT(
    POWER(SIN(RADIANS(r.latitude - ${lat}) / 2), 2) +
    COS(RADIANS(${lat})) * COS(RADIANS(r.latitude)) *
    POWER(SIN(RADIANS(r.longitude - ${lng}) / 2), 2)
  )))`;

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Tìm quán cho khách hàng (chỉ quán có status = ACTIVE).
   */
  async findNearby(query: NearbyRestaurantsQueryDto) {
    const { lat, lng, radiusKm, q, openOnly, page, limit } = query;
    const term = q?.trim();
    const offset = (page - 1) * limit;
    const scopeKm = term ? SEARCH_MAX_KM : radiusKm;
    const box = boundingBox({ lat, lng }, scopeKm);

    const filters: Prisma.Sql[] = [
      Prisma.sql`r.status = 'ACTIVE'`,
      Prisma.sql`r.latitude BETWEEN ${box.minLat} AND ${box.maxLat}`,
      Prisma.sql`r.longitude BETWEEN ${box.minLng} AND ${box.maxLng}`,
    ];
    if (term) {
      const like = `%${foldVietnamese(term)}%`;
      filters.push(Prisma.sql`(
        ${fold(Prisma.sql`r.name`)} LIKE ${like}
        OR ${fold(Prisma.sql`COALESCE(r.description, '')`)} LIKE ${like}
        OR EXISTS (
          SELECT 1 FROM menu_items mi
          WHERE mi."restaurantId" = r.id AND mi."isArchived" = false AND ${fold(Prisma.sql`mi.name`)} LIKE ${like}
        )
      )`);
    }
    if (openOnly) filters.push(Prisma.sql`r."isOpen" = true`);

    const reach = term
      ? Prisma.sql`"distanceKm" <= ${SEARCH_MAX_KM}`
      : Prisma.sql`"distanceKm" <= ${radiusKm} AND "distanceKm" <= "deliveryRadiusKm"`;

    const rows = await this.prisma.$queryRaw<NearbyRestaurant[]>`
      SELECT * FROM (
        SELECT ${RESTAURANT_COLUMNS}, ${distanceSql(lat, lng)} AS "distanceKm"
        FROM restaurants r
        WHERE ${Prisma.join(filters, ' AND ')}
      ) AS candidates
      WHERE ${reach}
      ORDER BY ("distanceKm" <= "deliveryRadiusKm") DESC, "isOpen" DESC, "distanceKm" ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    const hasMore = rows.length > limit;
    let items = rows.slice(0, limit).map((r) => this.toPublicRestaurant(r));
    if (openOnly) items = items.filter((r) => r.isOpen);

    if (term && items.length > 0) {
      const needle = foldVietnamese(term);
      const dishes = (
        await this.prisma.menuItem.findMany({
          where: { restaurantId: { in: items.map((r) => r.id) }, isArchived: false },
          select: { restaurantId: true, name: true },
          orderBy: { createdAt: 'desc' },
        })
      ).filter((d) => foldVietnamese(d.name).includes(needle));
      const byRestaurant = new Map<string, string[]>();
      for (const d of dishes) {
        const list = byRestaurant.get(d.restaurantId) ?? [];
        if (list.length < 3) list.push(d.name);
        byRestaurant.set(d.restaurantId, list);
      }
      items = items.map((r) => ({ ...r, matchedDishes: byRestaurant.get(r.id) ?? [] }));
    }

    if (!term && items.length === 0 && page === 1) {
      const nearest = await this.prisma.$queryRaw<NearbyRestaurant[]>`
        SELECT ${RESTAURANT_COLUMNS}, ${distanceSql(lat, lng)} AS "distanceKm"
        FROM restaurants r
        WHERE r.status = 'ACTIVE' AND r."isOpen" = true
        ORDER BY "distanceKm" ASC
        LIMIT 6
      `;
      if (nearest.length > 0) {
        return {
          items: nearest.map((r) => this.toPublicRestaurant(r)),
          page,
          limit,
          hasMore: false,
          isExpandedRadius: true,
          notice: 'Chưa có quán nào giao tới vị trí của bạn. Đây là các quán gần nhất (ngoài vùng giao hàng).',
        };
      }
    }

    return { items, page, limit, hasMore, isExpandedRadius: false };
  }

  /** Dữ liệu quán cho khách: khoảng cách làm tròn, phí ship ước tính từ backend, đang nhận đơn hay không. */
  private toPublicRestaurant(r: NearbyRestaurant) {
    const distanceKm = Math.round(Number(r.distanceKm) * 100) / 100;
    const est = this.computeEstimatedFee(distanceKm);
    return {
      ...r,
      distanceKm,
      estimatedDeliveryFee: est.estimatedDeliveryFee,
      estimatedMinutes: est.estimatedMinutes,
      canDeliver: distanceKm <= r.deliveryRadiusKm,
      isOpen: isAcceptingOrders(r),
    };
  }

  private computeEstimatedFee(haversineDistanceKm: number) {
    const biz = this.config?.get<BusinessConfig>('business');
    const factor = biz?.roadDistanceFallbackFactor ?? 1.3;
    const roadApproxKm = haversineDistanceKm * factor;
    const fee = calcDeliveryFee(roadApproxKm, {
      baseFee: biz?.deliveryBaseFee ?? 15000,
      feePerKm: biz?.deliveryFeePerKm ?? 5000,
      freeKm: biz?.deliveryFreeKm ?? 2,
      peakMultiplier: biz?.deliveryPeakMultiplier ?? 1.2,
      peakWindows: biz?.deliveryPeakWindows,
    });
    const est = estimateDelivery(roadApproxKm);
    return {
      estimatedDeliveryFee: fee,
      estimatedMinutes: { min: est.estimatedMinutesMin, max: est.estimatedMinutesMax },
    };
  }

  /**
   * Món ăn quanh người dùng cho trang chủ: chỉ lấy các quán ACTIVE đang nhận đơn trong bán kính.
   */
  async findNearbyDishes(query: NearbyRestaurantsQueryDto, perRestaurant = 3) {
    const { lat, lng, radiusKm, limit } = query;
    const box = boundingBox({ lat, lng }, radiusKm);

    const candidates = await this.prisma.$queryRaw<NearbyRestaurant[]>`
      SELECT * FROM (
        SELECT ${RESTAURANT_COLUMNS}, ${distanceSql(lat, lng)} AS "distanceKm"
        FROM restaurants r
        WHERE r.status = 'ACTIVE'
          AND r."isOpen" = true
          AND r.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
          AND r.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
      ) AS candidates
      WHERE "distanceKm" <= ${radiusKm} AND "distanceKm" <= "deliveryRadiusKm"
      ORDER BY "distanceKm" ASC
      LIMIT 30
    `;
    const restaurants = candidates.filter((r) => isAcceptingOrders(r));
    if (restaurants.length === 0) return { items: [] };

    const byId = new Map(restaurants.map((r) => [r.id, r]));
    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId: { in: [...byId.keys()] }, isAvailable: true, isArchived: false },
      select: {
        id: true,
        restaurantId: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        options: true,
        imageUrl: true,
        isAvailable: true,
        isArchived: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const groups = new Map<string, typeof menuItems>();
    for (const m of menuItems) {
      const g = groups.get(m.restaurantId) ?? [];
      if (g.length < perRestaurant) g.push(m);
      groups.set(m.restaurantId, g);
    }
    const orderedGroups = [...groups.entries()]
      .sort(([a], [b]) => Number(byId.get(a)!.distanceKm) - Number(byId.get(b)!.distanceKm))
      .map(([, g]) => g);
    const interleaved: typeof menuItems = [];
    for (let round = 0; round < perRestaurant; round++) {
      for (const g of orderedGroups) if (g[round]) interleaved.push(g[round]);
    }

    const items = interleaved.slice(0, limit).map((m) => {
      const r = byId.get(m.restaurantId)!;
      const distanceKm = Math.round(Number(r.distanceKm) * 100) / 100;
      const est = this.computeEstimatedFee(distanceKm);
      return {
        ...m,
        restaurant: {
          id: r.id,
          name: r.name,
          imageUrl: r.imageUrl,
          isOpen: true,
          rating: r.rating,
          ratingCount: r.ratingCount,
          latitude: r.latitude,
          longitude: r.longitude,
          distanceKm,
          estimatedDeliveryFee: est.estimatedDeliveryFee,
        },
      };
    });

    return { items };
  }

  async findOneWithMenu(id: string, user?: AuthUser, lat?: number, lng?: number) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: { where: { isArchived: false }, orderBy: { name: 'asc' } },
          },
        },
        menuItems: { where: { isArchived: false, categoryId: null }, orderBy: { name: 'asc' } },
      },
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');

    const isOwnerOrAdmin = Boolean(user && (user.role === Role.ADMIN || restaurant.ownerId === user.id));
    if (restaurant.status !== RestaurantStatus.ACTIVE && !isOwnerOrAdmin) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const { menuItems: uncategorized, ...rest } = restaurant;
    let distanceKm: number | undefined;
    let estimatedDeliveryFee: number | undefined;
    let estimatedMinutes: { min: number; max: number } | undefined;

    if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
      distanceKm = Math.round(haversineKm({ lat, lng }, { lat: rest.latitude, lng: rest.longitude }) * 100) / 100;
      const est = this.computeEstimatedFee(distanceKm);
      estimatedDeliveryFee = est.estimatedDeliveryFee;
      estimatedMinutes = est.estimatedMinutes;
    }

    return {
      ...rest,
      isOpen: isAcceptingOrders(rest),
      uncategorizedItems: uncategorized,
      ...(distanceKm !== undefined ? { distanceKm, estimatedDeliveryFee, estimatedMinutes } : {}),
    };
  }

  /** Quán của chủ quán: giữ nguyên công tắc isOpen, thêm acceptingOrders để biết khách có đặt được không. */
  async findMine(ownerId: string) {
    const rows = await this.prisma.restaurant.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...r, acceptingOrders: isAcceptingOrders(r) }));
  }

  async create(user: AuthUser, dto: CreateRestaurantDto) {
    const { ownerId: requestedOwnerId, ...data } = dto;
    const isAdmin = user.role === Role.ADMIN;
    const ownerId = isAdmin && requestedOwnerId ? requestedOwnerId : user.id;
    const status = isAdmin ? RestaurantStatus.ACTIVE : RestaurantStatus.PENDING_APPROVAL;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ...data,
          ownerId,
          status,
          ...(isAdmin ? { approvedAt: new Date(), approvedById: user.id } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'RESTAURANT_CREATE',
          targetType: 'RESTAURANT',
          targetId: created.id,
          metadata: { name: created.name, status, ownerId },
        },
      });
      return created;
    });
  }

  async update(id: string, user: AuthUser, dto: UpdateRestaurantDto) {
    const existing = await this.assertCanManage(id, user);
    const isOwner = user.role !== Role.ADMIN;

    const changedCriticalFields: string[] = [];
    if (dto.name !== undefined && dto.name.trim() !== existing.name) changedCriticalFields.push('name');
    if (dto.address !== undefined && dto.address.trim() !== existing.address) changedCriticalFields.push('address');
    if (dto.latitude !== undefined && Math.abs(dto.latitude - existing.latitude) > 1e-6) {
      changedCriticalFields.push('latitude');
    }
    if (dto.longitude !== undefined && Math.abs(dto.longitude - existing.longitude) > 1e-6) {
      changedCriticalFields.push('longitude');
    }

    const revertToPending =
      isOwner && existing.status === RestaurantStatus.ACTIVE && changedCriticalFields.length > 0;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurant.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(revertToPending
            ? {
                status: RestaurantStatus.PENDING_APPROVAL,
                approvedAt: null,
                approvedById: null,
                suspendReason: null,
              }
            : {}),
        },
      });

      if (revertToPending || user.role === Role.ADMIN || changedCriticalFields.length > 0) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: revertToPending ? 'RESTAURANT_CRITICAL_UPDATE' : 'RESTAURANT_UPDATE',
            targetType: 'RESTAURANT',
            targetId: id,
            metadata: {
              changedCriticalFields,
              revertedToPending: revertToPending,
              previous: {
                name: existing.name,
                address: existing.address,
                latitude: existing.latitude,
                longitude: existing.longitude,
                status: existing.status,
              },
            },
          },
        });
      }

      return updated;
    });
  }

  async delete(id: string, user: AuthUser) {
    const rest = await this.assertCanManage(id, user);
    const orders = await this.prisma.order.count({ where: { restaurantId: id } });
    if (orders > 0) {
      throw new ConflictException(
        `Quán đã có ${orders} đơn hàng nên không thể xoá. Hãy tạm đóng quán để ngừng nhận đơn.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.restaurant.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'RESTAURANT_DELETE',
          targetType: 'RESTAURANT',
          targetId: id,
          metadata: { restaurantName: rest.name },
        },
      });
      return deleted;
    });
  }

  /** Thống kê bán hàng của quán trong `days` ngày gần nhất (tính theo giờ VN). */
  async getStats(id: string, user: AuthUser, days: StatsRange) {
    await this.assertCanManage(id, user);
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: id,
        createdAt: { gte: statsRangeStart(now, days) },
      },
      select: {
        status: true,
        subtotal: true,
        createdAt: true,
        items: { select: { menuItemId: true, name: true, quantity: true, lineTotal: true } },
      },
    });
    return buildRestaurantStats(orders, now, days);
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
