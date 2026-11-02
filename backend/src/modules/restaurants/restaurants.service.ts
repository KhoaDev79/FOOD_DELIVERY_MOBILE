import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Restaurant, RestaurantStatus, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { boundingBox, calcDeliveryFee, estimateDelivery, haversineKm } from '../../common/utils/geo.util';
import { isAcceptingOrders } from '../../common/utils/opening-hours';
import { foldVietnamese, VI_ACCENTED, VI_PLAIN } from '../../common/utils/vietnamese';
import { BusinessConfig } from '../../config/configuration';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRestaurantDto,
  ListRestaurantReviewsQueryDto,
  NearbyRestaurantsQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurants.dto';
import { buildRestaurantStats, StatsRange, statsRangeStart } from './restaurant-stats';
import { rankSuggestions, SUGGESTION_WINDOW_DAYS } from './restaurant-suggestions';
import { LruCache } from '../../common/utils/lru-cache.util';

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
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /**
   * Tìm quán cho khách hàng (chỉ quán có status = ACTIVE).
   */
  async findNearby(query: NearbyRestaurantsQueryDto) {
    const { lat, lng, radiusKm, q, openOnly, page, limit } = query;
    const term = q?.trim();
    if (term && term.length >= 2) {
      this.prisma.searchLog.create({ data: { query: term } }).catch(() => {});
    }
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

  // Gợi ý món: lưu tạm 5 phút theo quán + món trong giỏ để không truy vấn lại mỗi lần mở giỏ
  private readonly suggestionCache = new LruCache<unknown>(5 * 60 * 1000, 2000);

  /**
   * Gợi ý món thêm vào giỏ: món hay được mua chung với món trong giỏ (đơn đã giao 90 ngày gần nhất),
   * thiếu thì bổ sung món bán chạy, rồi món khác của quán. Xem restaurant-suggestions.ts.
   */
  async getSuggestions(restaurantId: string, cartItemIds: string[]) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { status: true } });
    if (!rest || rest.status !== RestaurantStatus.ACTIVE) throw new NotFoundException('Không tìm thấy nhà hàng');

    const ids = [...new Set(cartItemIds)].sort();
    const cacheKey = `${restaurantId}:${ids.join(',')}`;
    const cached = this.suggestionCache.get(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - SUGGESTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [menu, coRows, sold] = await Promise.all([
      this.prisma.menuItem.findMany({ where: { restaurantId, isArchived: false } }),
      ids.length
        ? this.prisma.$queryRaw<{ menuItemId: string; cnt: bigint }[]>`
            SELECT oi2."menuItemId" AS "menuItemId", COUNT(DISTINCT oi2."orderId") AS cnt
            FROM order_items oi1
            JOIN order_items oi2 ON oi2."orderId" = oi1."orderId" AND oi2."menuItemId" <> oi1."menuItemId"
            JOIN orders o ON o.id = oi1."orderId"
            WHERE o."restaurantId" = ${restaurantId}::uuid
              AND o.status = 'DELIVERED'
              AND o."createdAt" >= ${since}
              AND oi1."menuItemId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
            GROUP BY oi2."menuItemId"`
        : Promise.resolve([]),
      this.prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: { order: { restaurantId, status: 'DELIVERED', createdAt: { gte: since } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 20,
      }),
    ]);

    const ranked = rankSuggestions({
      menu,
      boughtTogether: new Map(coRows.map((r) => [r.menuItemId, Number(r.cnt)])),
      bestSellers: new Map(sold.map((r) => [r.menuItemId, r._sum.quantity ?? 0])),
      cartItemIds: ids,
    });
    const result = { items: ranked.map((r) => ({ ...r.item, reason: r.reason, count: r.count })) };
    this.suggestionCache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
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

  // =========================================================================
  //  ĐÁNH GIÁ QUÁN & PHẢN HỒI CỦA CHỦ QUÁN (E3)
  // =========================================================================

  /** Rút gọn tên khách hàng để hiển thị công khai (ví dụ: "Nguyễn Văn An" -> "Nguyễn V. A.") */
  private maskCustomerName(fullName?: string | null): string {
    const clean = (fullName ?? '').trim();
    if (!clean) return 'Khách hàng';
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts
      .slice(1)
      .map((p) => `${p.charAt(0).toUpperCase()}.`)
      .join(' ')}`;
  }

  /** E3: Danh sách đánh giá công khai của quán (chỉ đánh giá chưa ẩn, ẩn thông tin nhạy cảm của khách) */
  async getPublicReviews(restaurantId: string, query: ListRestaurantReviewsQueryDto) {
    const rest = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, rating: true, ratingCount: true },
    });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const where: Prisma.ReviewWhereInput = {
      restaurantId,
      isHidden: false,
      ...(query.rating ? { rating: Number(query.rating) } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          ownerReply: true,
          ownerRepliedAt: true,
          createdAt: true,
          customer: { select: { fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      rating: rest.rating,
      ratingCount: rest.ratingCount,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        ownerReply: r.ownerReply,
        ownerRepliedAt: r.ownerRepliedAt,
        createdAt: r.createdAt,
        customerName: this.maskCustomerName(r.customer?.fullName),
        customerAvatarUrl: r.customer?.avatarUrl ?? null,
      })),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** E3: Danh sách đánh giá dành cho Chủ quán / Admin quản lý & trả lời */
  async getManageReviews(restaurantId: string, user: AuthUser, query: ListRestaurantReviewsQueryDto) {
    const rest = await this.assertCanManage(restaurantId, user);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const where: Prisma.ReviewWhereInput = {
      restaurantId,
      ...(query.rating ? { rating: Number(query.rating) } : {}),
      ...(query.unrepliedOnly ? { ownerReply: null } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          orderId: true,
          rating: true,
          comment: true,
          driverRating: true,
          driverComment: true,
          ownerReply: true,
          ownerRepliedAt: true,
          isHidden: true,
          createdAt: true,
          customer: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      rating: rest.rating,
      ratingCount: rest.ratingCount,
      items: rows,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** E3: Chủ quán phản hồi đánh giá (chỉ được trả lời đúng 1 lần) */
  async replyToReview(reviewId: string, user: AuthUser, replyText: string) {
    const cleanReply = replyText.trim();
    if (!cleanReply) {
      throw new BadRequestException('Nội dung phản hồi không được để trống');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        restaurant: { select: { id: true, name: true, ownerId: true } },
      },
    });
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    if (user.role !== 'ADMIN' && review.restaurant.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không phải chủ nhà hàng của đánh giá này');
    }
    if (review.ownerReply !== null) {
      throw new ConflictException('Đánh giá này đã được phản hồi trước đó');
    }

    const { count } = await this.prisma.review.updateMany({
      where: { id: reviewId, ownerReply: null },
      data: {
        ownerReply: cleanReply,
        ownerRepliedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('Đánh giá này đã được phản hồi trước đó');
    }

    const updated = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    if (review.orderId && review.customerId) {
      void this.notifications?.notifyReviewReplied({
        id: review.id,
        orderId: review.orderId,
        customerId: review.customerId,
        restaurantName: review.restaurant.name,
      });
    }
    return updated;
  }
}
