import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, ListOrdersQueryDto } from './dto/orders.dto';
import { canViewOrder } from './order-access';
import { OrderPricingService } from './order-pricing.service';
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
    private readonly orderPricing: OrderPricingService,
  ) {}

  // =========================================================================
  //  ĐẶT ĐƠN — kiểm tra quoteToken + idempotency + toàn bộ trong 1 transaction
  // =========================================================================
  async create(customerId: string, dto: CreateOrderDto, idempotencyKey?: string): Promise<OrderDetail> {
    const cleanIdemKey = idempotencyKey?.trim() ? idempotencyKey.trim().slice(0, 100) : null;

    if (cleanIdemKey) {
      const existing = await this.prisma.order.findUnique({
        where: {
          customerId_idempotencyKey: {
            customerId,
            idempotencyKey: cleanIdemKey,
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });
      // Cùng khách + cùng key trong 10 phút -> trả lại đơn đã tạo, không tạo đơn mới
      if (existing && Date.now() - existing.createdAt.getTime() <= 10 * 60 * 1000) {
        return existing;
      }
    }

    // Kiểm tra số lần giao thất bại trong 30 ngày gần nhất của khách (C5)
    const maxFailed = Number(this.config.get<number>('business.customerMaxFailedDeliveries') ?? 2);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFailedCount = await this.prisma.order.count({
      where: {
        customerId,
        status: OrderStatus.DELIVERY_FAILED,
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    if (recentFailedCount >= maxFailed) {
      throw new ForbiddenException(
        'Tài khoản tạm thời không thể đặt đơn tiền mặt, liên hệ hỗ trợ',
      );
    }

    let order: OrderDetail;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const priced = await this.orderPricing.verifyAndPriceOrder(customerId, dto, tx);

        return tx.order.create({
          data: {
            customerId,
            restaurantId: dto.restaurantId,
            paymentMethod: PaymentMethod.COD,
            subtotal: priced.quote.subtotal,
            deliveryFee: priced.quote.deliveryFee,
            peakSurcharge: priced.quote.peakSurcharge,
            platformCommission: priced.platformCommission,
            driverEarning: priced.driverEarning,
            total: priced.quote.total,
            distanceKm: priced.quote.distanceKm,
            distanceSource: priced.quote.distanceSource,
            deliveryAddress: priced.deliveryAddress,
            deliveryLat: priced.deliveryLat,
            deliveryLng: priced.deliveryLng,
            estimatedDeliveryAt: priced.estimatedDeliveryAt,
            idempotencyKey: cleanIdemKey,
            note: dto.note,
            items: { create: priced.dbLines },
            statusHistory: { create: { status: 'PENDING', changedBy: customerId } },
          },
          include: ORDER_DETAIL_INCLUDE,
        });
      });
    } catch (err: any) {
      if (cleanIdemKey && err?.code === 'P2002') {
        const existing = await this.prisma.order.findUnique({
          where: {
            customerId_idempotencyKey: {
              customerId,
              idempotencyKey: cleanIdemKey,
            },
          },
          include: ORDER_DETAIL_INCLUDE,
        });
        if (existing) return existing;
      }
      throw err;
    }

    // Chỉ phát sự kiện sau khi transaction đã commit
    this.gateway.emitOrderUpdated('order:created', order);
    this.notifications.notifyOrderCreated(order);
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
}
