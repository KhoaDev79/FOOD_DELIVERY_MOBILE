import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { calcDeliveryFee, haversineKm } from '../../common/utils/geo.util';
import { isWithinOpeningHours } from '../../common/utils/opening-hours';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, ListOrdersQueryDto } from './dto/orders.dto';
import { canViewOrder } from './order-access';
import { lineKey, OrderPricingError, priceOrderLine } from './order-pricing';
import {
  actorMayTransition,
  DRIVER_ACCEPTABLE_STATUSES,
  isValidTransition,
  OrderActor,
} from './order-state-machine';
import { buildDriverStats, DriverStats } from './driver-stats';
import { statsRangeStart } from '../restaurants/restaurant-stats';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  restaurant: {
    select: { id: true, name: true, imageUrl: true, address: true, latitude: true, longitude: true, ownerId: true },
  },
  customer: { select: { id: true, fullName: true, phone: true } },
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      driverProfile: {
        select: {
          vehicleType: true,
          vehicleBrand: true,
          vehicleModel: true,
          vehicleColor: true,
          licensePlate: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

/** Số đơn một tài xế được giao cùng lúc (đơn đã nhận nhưng chưa giao xong). */
export const MAX_ACTIVE_DELIVERIES = 2;
const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

/**
 * Đơn VNPay chưa thanh toán xong thì quán và tài xế chưa được thấy (giống app thực tế:
 * quán chỉ nhận đơn khi khách đã trả tiền). Đơn tiền mặt (COD) luôn hiện.
 */
const VISIBLE_TO_MERCHANT: Prisma.OrderWhereInput = {
  OR: [{ paymentMethod: 'COD' }, { paymentStatus: 'PAID' }, { paymentStatus: 'REFUNDED' }],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: OrdersGateway,
    private readonly restaurants: RestaurantsService,
    private readonly notifications: NotificationsService,
  ) {}

  // =========================================================================
  //  ĐẶT ĐƠN — toàn bộ trong 1 transaction, giá luôn lấy từ DB
  // =========================================================================
  async create(customerId: string, dto: CreateOrderDto): Promise<OrderDetail> {
    const location = await this.resolveDeliveryLocation(customerId, dto);
    const requested = this.mergeItems(dto.items);
    const menuItemIds = [...new Set([...requested.values()].map((l) => l.menuItemId))];
    const deliveryCfg = this.config.getOrThrow('delivery');

    const order = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.findUnique({ where: { id: dto.restaurantId } });
      if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
      if (!restaurant.isOpen) throw new BadRequestException('Nhà hàng hiện đang đóng cửa');
      if (!isWithinOpeningHours(restaurant.openTime, restaurant.closeTime)) {
        throw new BadRequestException(
          `Quán chỉ nhận đơn từ ${restaurant.openTime} đến ${restaurant.closeTime}. Vui lòng quay lại sau.`,
        );
      }

      const distanceKm = haversineKm(
        { lat: restaurant.latitude, lng: restaurant.longitude },
        { lat: location.lat, lng: location.lng },
      );
      if (distanceKm > restaurant.deliveryRadiusKm) {
        throw new BadRequestException(
          `Địa chỉ nằm ngoài bán kính giao hàng của quán (${restaurant.deliveryRadiusKm} km)`,
        );
      }

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          restaurantId: restaurant.id, // chặn trộn món của quán khác
          isAvailable: true,
          isArchived: false,
        },
        select: { id: true, name: true, price: true, discountPrice: true, options: true },
      });
      if (menuItems.length !== menuItemIds.length) {
        const found = new Set(menuItems.map((m) => m.id));
        throw new BadRequestException({
          message: 'Một số món không tồn tại hoặc đã hết',
          unavailableItemIds: menuItemIds.filter((id) => !found.has(id)),
        });
      }

      // Đơn giá tính lại hoàn toàn từ DB: giá giảm (nếu có) + size + topping của chính món đó.
      const byId = new Map(menuItems.map((m) => [m.id, m]));
      const lines = [...requested.values()].map((req) => {
        const m = byId.get(req.menuItemId)!;
        let priced: ReturnType<typeof priceOrderLine>;
        try {
          priced = priceOrderLine(m, req);
        } catch (e) {
          if (e instanceof OrderPricingError) throw new BadRequestException(e.message);
          throw e;
        }
        return {
          menuItemId: m.id,
          name: m.name,
          unitPrice: priced.unitPrice,
          quantity: req.quantity,
          lineTotal: priced.unitPrice * req.quantity,
          note: req.note,
          options: priced.selected ? (priced.selected as unknown as Prisma.InputJsonValue) : undefined,
        };
      });
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const deliveryFee = calcDeliveryFee(distanceKm, deliveryCfg);

      return tx.order.create({
        data: {
          customerId,
          restaurantId: restaurant.id,
          paymentMethod: dto.paymentMethod,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          distanceKm: Math.round(distanceKm * 100) / 100,
          deliveryAddress: location.address,
          deliveryLat: location.lat,
          deliveryLng: location.lng,
          note: dto.note,
          items: { create: lines },
          statusHistory: { create: { status: 'PENDING', changedBy: customerId } },
        },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    // Chỉ phát sự kiện sau khi transaction đã commit
    this.gateway.emitOrderUpdated('order:created', order);
    // Đơn VNPay: quán chỉ được báo khi thanh toán thành công (xem PaymentsService)
    if (order.paymentMethod === 'COD') this.notifications.notifyOrderCreated(order);
    return order;
  }

  // =========================================================================
  //  CẬP NHẬT TRẠNG THÁI — state machine + optimistic concurrency
  // =========================================================================
  async updateStatus(orderId: string, user: AuthUser, to: OrderStatus): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    const actor = this.resolveActor(order, user);

    if (!isValidTransition(order.status, to)) {
      throw new BadRequestException(`Không thể chuyển đơn từ ${order.status} sang ${to}`);
    }
    if (!actor || !actorMayTransition(actor, order.status, to)) {
      throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái này');
    }
    if (to === 'PICKED_UP' && !order.driverId) {
      throw new BadRequestException('Đơn chưa có tài xế nhận');
    }
    if (to === 'CONFIRMED' && order.paymentMethod === 'VNPAY' && order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Đơn VNPay chưa được thanh toán, chưa thể nhận đơn');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // WHERE status = trạng thái vừa đọc => nếu ai đó đã đổi trước, count = 0
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === 'DELIVERED' && order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' as const } : {}),
          // Huỷ đơn đã trả tiền online: đánh dấu cần hoàn tiền cho khách
          ...(to === 'CANCELLED' && order.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' as const } : {}),
        },
      });
      if (count === 0) throw new ConflictException('Trạng thái đơn đã thay đổi, vui lòng tải lại');

      await tx.orderStatusHistory.create({ data: { orderId, status: to, changedBy: user.id } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    if (to === 'CONFIRMED' && !updated.driverId) this.gateway.emitOrderAvailable(updated);
    this.notifications.notifyStatusChanged(updated);
    return updated;
  }

  /** Tài xế nhận đơn — atomic, chỉ 1 tài xế thắng khi tranh chấp. */
  async acceptByDriver(orderId: string, driverId: string): Promise<OrderDetail> {
    await this.assertDriverCanAccept(driverId);

    const active = await this.prisma.order.count({
      where: { driverId, status: { in: ACTIVE_DELIVERY_STATUSES } },
    });
    if (active >= MAX_ACTIVE_DELIVERIES) {
      throw new BadRequestException(
        `Bạn đang giao ${active} đơn. Hãy hoàn thành bớt trước khi nhận thêm (tối đa ${MAX_ACTIVE_DELIVERIES} đơn cùng lúc).`,
      );
    }
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES }, ...VISIBLE_TO_MERCHANT },
      data: { driverId },
    });
    if (count === 0) {
      const exists = await this.prisma.order.count({ where: { id: orderId } });
      if (!exists) throw new NotFoundException('Không tìm thấy đơn hàng');
      throw new ConflictException('Đơn đã có tài xế khác nhận hoặc không còn khả dụng');
    }
    const order = await this.getOrderOrThrow(orderId);
    this.gateway.emitOrderUpdated('order:driver_assigned', order);
    this.notifications.notifyDriverAssigned(order);
    return order;
  }

  /** Kiểm tra điều kiện nhận đơn: tài khoản hoạt động, hồ sơ APPROVED và đang trực tuyến */
  async assertDriverCanAccept(driverId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException('Tài khoản tài xế của bạn đang bị khoá');
    }
    const profile = user.driverProfile;
    if (!profile || profile.verificationStatus === 'PENDING') {
      throw new BadRequestException('Hồ sơ tài xế của bạn đang chờ phê duyệt. Vui lòng cập nhật thông tin xe và đợi duyệt.');
    }
    if (profile.verificationStatus === 'REJECTED') {
      throw new BadRequestException(
        `Hồ sơ tài xế của bạn đã bị từ chối: ${profile.rejectionReason || 'Vui lòng kiểm tra lại phương tiện.'}`,
      );
    }
    if (profile.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException(
        `Tài khoản tài xế của bạn đang bị tạm khoá: ${profile.rejectionReason || 'Vui lòng liên hệ hỗ trợ.'}`,
      );
    }
    if (!profile.isOnline) {
      throw new BadRequestException('Bạn đang ngoại tuyến. Vui lòng bật trực tuyến trước khi nhận chuyến.');
    }
  }

  // =========================================================================
  //  TRUY VẤN
  // =========================================================================
  async findOne(orderId: string, user: AuthUser): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    // Trả 404 thay vì 403 để không lộ sự tồn tại của đơn
    if (!canViewOrder(order, user)) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  findForCustomer(customerId: string, q: ListOrdersQueryDto) {
    return this.paginate({ customerId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async findForRestaurant(restaurantId: string, user: AuthUser, q: ListOrdersQueryDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.paginate({ restaurantId, ...VISIBLE_TO_MERCHANT, ...(q.status ? { status: q.status } : {}) }, q);
  }

  findForDriver(driverId: string, q: ListOrdersQueryDto) {
    return this.paginate({ driverId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async findAvailableForDrivers(driverId: string, q: ListOrdersQueryDto) {
    await this.assertDriverCanAccept(driverId);
    return this.paginate({ driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES }, ...VISIBLE_TO_MERCHANT }, q, 'asc');
  }

  async getDriverStats(driverId: string, days: number): Promise<DriverStats> {
    if (days !== 1 && days !== 7 && days !== 30) {
      throw new BadRequestException('Số ngày thống kê không hợp lệ (chỉ chấp nhận 1, 7 hoặc 30 ngày)');
    }
    const now = new Date();
    const start = statsRangeStart(now, days);
    const orders = await this.prisma.order.findMany({
      where: {
        driverId,
        createdAt: { gte: start },
      },
      select: {
        status: true,
        deliveryFee: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    return buildDriverStats(orders, now, days);
  }

  // =========================================================================
  //  ĐÁNH GIÁ — khách chấm điểm quán sau khi nhận hàng
  // =========================================================================
  async review(orderId: string, customerId: string, rating: number, comment?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Chỉ đánh giá được đơn đã giao thành công');

    // Mỗi đơn đã giao được đánh giá 1 lần: số đánh giá của khách cho quán không vượt số đơn đã giao.
    // (Bảng reviews chưa có cột orderId nên đếm theo cặp khách – quán.)
    const where = { customerId, restaurantId: order.restaurantId };
    const [reviews, delivered] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.order.count({ where: { ...where, status: 'DELIVERED' } }),
    ]);
    if (reviews >= delivered) throw new ConflictException('Bạn đã đánh giá đơn hàng này rồi');

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { ...where, rating, comment: comment?.trim() || null },
      });
      const { _avg } = await tx.review.aggregate({ where: { restaurantId: order.restaurantId }, _avg: { rating: true } });
      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: { rating: Math.round((_avg.rating ?? rating) * 10) / 10 },
      });
      return review;
    });
  }

  // =========================================================================
  //  HELPERS
  // =========================================================================
  private async paginate(where: Prisma.OrderWhereInput, q: ListOrdersQueryDto, order: 'asc' | 'desc' = 'desc') {
    const rows = await this.prisma.order.findMany({
      where,
      include: {
        items: { select: { name: true, quantity: true, unitPrice: true } },
        restaurant: { select: { id: true, name: true, imageUrl: true, address: true, latitude: true, longitude: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { createdAt: order },
      skip: (q.page - 1) * q.limit,
      take: q.limit + 1,
    });
    return { items: rows.slice(0, q.limit), page: q.page, limit: q.limit, hasMore: rows.length > q.limit };
  }

  private async getOrderOrThrow(orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  private resolveActor(order: OrderDetail, user: AuthUser): OrderActor | null {
    if (user.role === 'ADMIN') return 'ADMIN';
    if (user.role === 'RESTAURANT_OWNER' && order.restaurant.ownerId === user.id) return 'OWNER';
    if (user.role === 'DRIVER' && order.driverId === user.id) return 'DRIVER';
    if (user.role === 'CUSTOMER' && order.customerId === user.id) return 'CUSTOMER';
    return null;
  }

  /**
   * Gộp các dòng cùng món và cùng tuỳ chọn. Giới hạn 50 tính trên tổng số lượng của mỗi món
   * (kể cả khi tách nhiều dòng với tuỳ chọn khác nhau) để client không né được giới hạn.
   */
  private mergeItems(items: CreateOrderDto['items']) {
    type Line = {
      menuItemId: string;
      quantity: number;
      note?: string;
      sizeId?: string;
      toppingIds?: string[];
      level?: string;
    };
    const map = new Map<string, Line>();
    const perItem = new Map<string, number>();
    for (const it of items) {
      const key = lineKey(it.menuItemId, it);
      const prev = map.get(key);
      if (prev) {
        prev.quantity += it.quantity;
        if (it.note) prev.note = [prev.note, it.note].filter(Boolean).join('; ');
      } else {
        map.set(key, {
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          note: it.note,
          sizeId: it.sizeId,
          toppingIds: it.toppingIds,
          level: it.level,
        });
      }
      perItem.set(it.menuItemId, (perItem.get(it.menuItemId) ?? 0) + it.quantity);
    }
    for (const [, total] of perItem) {
      if (total > 50) throw new BadRequestException('Số lượng mỗi món tối đa là 50');
    }
    return map;
  }

  private async resolveDeliveryLocation(customerId: string, dto: CreateOrderDto) {
    if (dto.addressId) {
      const addr = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId: customerId } });
      if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ giao hàng');
      return { address: addr.addressLine, lat: addr.latitude, lng: addr.longitude };
    }
    if (!dto.deliveryAddress || dto.deliveryLat === undefined || dto.deliveryLng === undefined) {
      throw new BadRequestException('Cần cung cấp addressId hoặc deliveryAddress + deliveryLat + deliveryLng');
    }
    return { address: dto.deliveryAddress, lat: dto.deliveryLat, lng: dto.deliveryLng };
  }
}
