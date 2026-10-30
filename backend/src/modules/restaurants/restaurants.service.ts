import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Restaurant } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { boundingBox } from '../../common/utils/geo.util';
import { isAcceptingOrders } from '../../common/utils/opening-hours';
import { foldVietnamese, VI_ACCENTED, VI_PLAIN } from '../../common/utils/vietnamese';
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
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  isOpen: boolean;
  rating: number;
  /** Giờ mở/đóng cửa dạng "HH:mm" (bổ sung cho trang chủ). */
  openTime: string;
  closeTime: string;
  distanceKm: number;
}

/** Phạm vi tối đa khi khách tìm theo từ khoá (km): quán xa hơn coi như không liên quan. */
const SEARCH_MAX_KM = 50;

const RESTAURANT_COLUMNS = Prisma.sql`
  r.id, r.name, r.description, r."imageUrl", r.address,
  r.latitude, r.longitude, r."deliveryRadiusKm", r."isOpen", r.rating, r."openTime", r."closeTime"`;

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tìm quán cho khách hàng.
   *
   * Không có từ khoá (trang chủ, gợi ý): chỉ quán GIAO ĐƯỢC tới vị trí khách, tức là nằm trong
   * bán kính tìm kiếm VÀ trong bán kính giao hàng của chính quán.
   *
   * Có từ khoá: khớp tên quán, mô tả quán hoặc tên món đang bán (chưa xoá). Quán khớp nhưng ở
   * ngoài vùng giao vẫn được trả về (trong phạm vi SEARCH_MAX_KM) với `canDeliver = false` và xếp
   * sau, để khách biết quán có tồn tại nhưng không giao tới địa chỉ hiện tại — giống app thực tế.
   * Không bao giờ trả về quán không liên quan tới từ khoá.
   *
   * `isOpen` trả về cho khách là trạng thái NHẬN ĐƠN thực tế: chủ quán bật mở cửa VÀ đang trong
   * giờ mở cửa (giờ VN).
   */
  async findNearby(query: NearbyRestaurantsQueryDto) {
    const { lat, lng, radiusKm, q, openOnly, page, limit } = query;
    const term = q?.trim();
    const offset = (page - 1) * limit;
    const scopeKm = term ? SEARCH_MAX_KM : radiusKm;
    const box = boundingBox({ lat, lng }, scopeKm);

    const filters: Prisma.Sql[] = [
      Prisma.sql`r.latitude BETWEEN ${box.minLat} AND ${box.maxLat}`,
      Prisma.sql`r.longitude BETWEEN ${box.minLng} AND ${box.maxLng}`,
    ];
    if (term) {
      // Không phân biệt dấu và hoa/thường: "pho" khớp "Phở"
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
    // Lọc "đang mở cửa" theo cả giờ mở cửa (SQL chỉ lọc được công tắc của chủ quán)
    if (openOnly) items = items.filter((r) => r.isOpen);

    if (term && items.length > 0) {
      // Cho khách thấy vì sao quán khớp: tên các món trùng từ khoá
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
      // Không quán nào giao tới vị trí này: cho khách xem các quán gần nhất nhưng đánh dấu rõ
      // là KHÔNG giao tới (canDeliver = false), để không đặt được đơn chắc chắn bị từ chối.
      const nearest = await this.prisma.$queryRaw<NearbyRestaurant[]>`
        SELECT ${RESTAURANT_COLUMNS}, ${distanceSql(lat, lng)} AS "distanceKm"
        FROM restaurants r
        WHERE r."isOpen" = true
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

  /** Dữ liệu quán cho khách: khoảng cách làm tròn, giao được hay không, đang nhận đơn hay không. */
  private toPublicRestaurant(r: NearbyRestaurant) {
    const distanceKm = Math.round(Number(r.distanceKm) * 100) / 100;
    return {
      ...r,
      distanceKm,
      canDeliver: distanceKm <= r.deliveryRadiusKm,
      isOpen: isAcceptingOrders(r),
    };
  }

  /**
   * Món ăn quanh người dùng cho trang chủ: lấy các quán đang nhận đơn trong bán kính
   * (cùng điều kiện với findNearby), rồi lấy món còn bán của các quán đó.
   * Món MỚI NHẤT của mỗi quán được ưu tiên (để món chủ quán vừa thêm hiện ngay);
   * mỗi quán tối đa `perRestaurant` món, xếp xen kẽ theo khoảng cách để danh sách đa dạng.
   */
  async findNearbyDishes(query: NearbyRestaurantsQueryDto, perRestaurant = 3) {
    const { lat, lng, radiusKm, limit } = query;
    const box = boundingBox({ lat, lng }, radiusKm);

    const candidates = await this.prisma.$queryRaw<NearbyRestaurant[]>`
      SELECT * FROM (
        SELECT ${RESTAURANT_COLUMNS}, ${distanceSql(lat, lng)} AS "distanceKm"
        FROM restaurants r
        WHERE r."isOpen" = true
          AND r.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
          AND r.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
      ) AS candidates
      WHERE "distanceKm" <= ${radiusKm} AND "distanceKm" <= "deliveryRadiusKm"
      ORDER BY "distanceKm" ASC
      LIMIT 30
    `;
    // Chỉ quán đang trong giờ mở cửa
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
      return {
        ...m,
        restaurant: {
          id: r.id,
          name: r.name,
          imageUrl: r.imageUrl,
          isOpen: true,
          rating: r.rating,
          latitude: r.latitude,
          longitude: r.longitude,
          distanceKm: Math.round(Number(r.distanceKm) * 100) / 100,
        },
      };
    });

    return { items };
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
    // isOpen cho khách = đang nhận đơn thực tế (công tắc của chủ quán + giờ mở cửa)
    return { ...rest, isOpen: isAcceptingOrders(rest), uncategorizedItems: uncategorized };
  }

  /** Quán của chủ quán: giữ nguyên công tắc isOpen, thêm acceptingOrders để biết khách có đặt được không. */
  async findMine(ownerId: string) {
    const rows = await this.prisma.restaurant.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...r, acceptingOrders: isAcceptingOrders(r) }));
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

  /** Thống kê bán hàng của quán trong `days` ngày gần nhất (tính theo giờ VN). */
  async getStats(id: string, user: AuthUser, days: StatsRange) {
    await this.assertCanManage(id, user);
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: id,
        createdAt: { gte: statsRangeStart(now, days) },
        // Bỏ đơn VNPay chưa thanh toán (quán chưa thấy đơn này)
        OR: [{ paymentMethod: 'COD' }, { paymentStatus: { in: ['PAID', 'REFUNDED'] } }],
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
