import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FailedDeliveryReason,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { haversineKm } from '../../common/utils/geo.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { statsRangeStart, VN_OFFSET_MINUTES } from '../restaurants/restaurant-stats';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { buildDriverStats, DriverStats } from './driver-stats';
import {
  CreateOrderDto,
  DriverArrivedDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { canViewOrder } from './order-access';
import { OrderPricingService } from './order-pricing.service';
import {
  actorMayTransition,
  DRIVER_ACCEPTABLE_STATUSES,
  isValidTransition,
  OrderActor,
  validateCancellationInput,
} from './order-state-machine';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  restaurant: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      address: true,
      phone: true,
      latitude: true,
      longitude: true,
      ownerId: true,
    },
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
          lastLatitude: true,
          lastLongitude: true,
          lastLocationAt: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  contactAttempts: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
];

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
  //  CẬP NHẬT TRẠNG THÁI — state machine + lý do huỷ + công nợ COD + giao thất bại
  // =========================================================================
  async updateStatus(
    orderId: string,
    userOrSystem: AuthUser | 'SYSTEM',
    dto: UpdateOrderStatusDto | OrderStatus,
  ): Promise<OrderDetail> {
    const payload: UpdateOrderStatusDto =
      typeof dto === 'string' ? { status: dto } : dto;
    const to = payload.status;

    const order = await this.getOrderOrThrow(orderId);
    const actor: OrderActor | null =
      userOrSystem === 'SYSTEM' ? 'SYSTEM' : this.resolveActor(order, userOrSystem);
    const changedBy: string | null =
      userOrSystem === 'SYSTEM' ? null : userOrSystem.id;

    if (!isValidTransition(order.status, to)) {
      throw new BadRequestException(`Không thể chuyển đơn từ ${order.status} sang ${to}`);
    }

    if (to === 'CANCELLED' && actor) {
      const cancelValidationError = validateCancellationInput(
        actor,
        order.status,
        payload.cancelReason,
        payload.cancelNote,
      );
      if (cancelValidationError) {
        throw new BadRequestException(cancelValidationError);
      }
    }

    if (!actor || !actorMayTransition(actor, order.status, to, payload.cancelReason)) {
      throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái này');
    }

    if (to === 'PICKED_UP' && !order.driverId) {
      throw new BadRequestException('Đơn chưa có tài xế nhận');
    }

    // C5: Kiểm tra điều kiện giao thất bại (bằng chứng đã đến + thời gian chờ + số lần gọi)
    if (to === 'DELIVERY_FAILED') {
      if (!payload.failedReason) {
        throw new BadRequestException('Vui lòng chọn lý do giao hàng thất bại');
      }
      if (!order.arrivedAt) {
        throw new ConflictException(
          'Bạn cần xác nhận đã đến điểm giao hàng trước khi báo giao thất bại',
        );
      }
      const minWaitMinutes = Number(
        this.config.get<number>('business.failedDeliveryMinWaitMinutes') ?? 10,
      );
      const elapsedMs = Date.now() - order.arrivedAt.getTime();
      const requiredMs = minWaitMinutes * 60 * 1000;
      if (elapsedMs < requiredMs) {
        const remainingMin = Math.max(1, Math.ceil((requiredMs - elapsedMs) / 60000));
        throw new ConflictException(`Cần chờ thêm ${remainingMin} phút`);
      }

      if (payload.failedReason === FailedDeliveryReason.CUSTOMER_UNREACHABLE) {
        const minCalls = Number(
          this.config.get<number>('business.failedDeliveryMinCalls') ?? 3,
        );
        const callsAfterArrived = await this.prisma.deliveryContactAttempt.count({
          where: {
            orderId: order.id,
            driverId: order.driverId!,
            createdAt: { gte: order.arrivedAt },
          },
        });
        if (callsAfterArrived < minCalls) {
          const remainingCalls = minCalls - callsAfterArrived;
          throw new ConflictException(`Cần gọi thêm ${remainingCalls} lần`);
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // WHERE status = trạng thái vừa đọc => nếu ai đó đã đổi trước, count = 0
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === 'DELIVERED' && order.paymentMethod === 'COD'
            ? { paymentStatus: 'PAID' as const }
            : {}),
          ...(to === 'CANCELLED'
            ? {
                cancelReason: payload.cancelReason,
                cancelNote: payload.cancelNote?.trim() || null,
                cancelledById: changedBy,
                ...(order.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' as const } : {}),
              }
            : {}),
          ...(to === 'DELIVERY_FAILED'
            ? {
                failedReason: payload.failedReason,
                cancelNote: payload.cancelNote?.trim() || null,
              }
            : {}),
        },
      });
      if (count === 0) {
        throw new ConflictException('Trạng thái đơn đã thay đổi, vui lòng tải lại');
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: to,
          changedBy,
        },
      });

      // C4: Ghi công nợ COD khi giao thành công (cùng transaction)
      if (to === 'DELIVERED' && order.paymentMethod === 'COD' && order.driverId) {
        const debtAmount = order.subtotal + order.platformCommission;
        await tx.$queryRaw`SELECT "id" FROM "driver_profiles" WHERE "userId" = ${order.driverId}::uuid FOR UPDATE`;
        const updatedProfile = await tx.driverProfile.update({
          where: { userId: order.driverId },
          data: { codBalance: { increment: debtAmount } },
        });
        await tx.driverLedger.create({
          data: {
            driverId: order.driverId,
            orderId: order.id,
            type: LedgerEntryType.COD_COLLECTED,
            amount: debtAmount,
            balanceAfter: updatedProfile.codBalance,
            note: `Thu hộ COD đơn #${order.id.slice(0, 8).toUpperCase()}`,
          },
        });
      }

      // C5: Giao thất bại -> giảm nợ cho tài xế bằng driverEarning và tăng failedDeliveryCount của khách
      if (to === 'DELIVERY_FAILED' && order.driverId) {
        const earningCredit = order.driverEarning;
        await tx.$queryRaw`SELECT "id" FROM "driver_profiles" WHERE "userId" = ${order.driverId}::uuid FOR UPDATE`;
        const updatedProfile = await tx.driverProfile.update({
          where: { userId: order.driverId },
          data: { codBalance: { decrement: earningCredit } },
        });
        await tx.driverLedger.create({
          data: {
            driverId: order.driverId,
            orderId: order.id,
            type: LedgerEntryType.ADJUSTMENT,
            amount: -earningCredit,
            balanceAfter: updatedProfile.codBalance,
            note: `Công giao thất bại đơn #${order.id.slice(0, 8).toUpperCase()}`,
          },
        });
        await tx.user.update({
          where: { id: order.customerId },
          data: { failedDeliveryCount: { increment: 1 } },
        });
      }

      // Ghi AuditLog khi ADMIN can thiệp trạng thái đơn
      if (actor === 'ADMIN' && changedBy) {
        await tx.auditLog.create({
          data: {
            actorId: changedBy,
            action: `ORDER_STATUS_${to}`,
            targetType: 'ORDER',
            targetId: orderId,
            metadata: {
              from: order.status,
              to,
              cancelReason: payload.cancelReason ?? null,
              cancelNote: payload.cancelNote?.trim() || null,
            },
          },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    if (to === 'CONFIRMED' && !updated.driverId) this.gateway.emitOrderAvailable(updated);
    this.notifications.notifyStatusChanged(updated);
    return updated;
  }

  // =========================================================================
  //  TÀI XẾ NHẬN ĐƠN / TRẢ ĐƠN / ĐẾN ĐIỂM GIAO / GỌI KHÁCH
  // =========================================================================

  /** Tài xế nhận đơn — atomic, kiểm tra hạn mức nợ COD và số đơn đang giao */
  async acceptByDriver(orderId: string, driverId: string): Promise<OrderDetail> {
    const targetOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, subtotal: true, platformCommission: true },
    });
    if (!targetOrder) throw new NotFoundException('Không tìm thấy đơn hàng');

    const orderDebt = targetOrder.subtotal + targetOrder.platformCommission;
    await this.assertDriverCanAccept(driverId, orderDebt);

    const maxActive = Number(this.config.get<number>('business.driverMaxActiveOrders') ?? 2);
    const active = await this.prisma.order.count({
      where: { driverId, status: { in: ACTIVE_DELIVERY_STATUSES } },
    });
    if (active >= maxActive) {
      throw new BadRequestException(
        `Bạn đang giao ${active} đơn. Hãy hoàn thành bớt trước khi nhận thêm (tối đa ${maxActive} đơn cùng lúc).`,
      );
    }

    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES } },
      data: { driverId },
    });
    if (count === 0) {
      throw new ConflictException('Đơn đã có tài xế khác nhận hoặc không còn khả dụng');
    }

    const order = await this.getOrderOrThrow(orderId);
    this.gateway.emitOrderUpdated('order:driver_assigned', order);
    this.notifications.notifyDriverAssigned(order);
    return order;
  }

  /** C3: Tài xế trả lại đơn chưa lấy món (tối đa 3 lần/ngày) */
  async releaseByDriver(orderId: string, driverId: string, reason: string): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Bạn không phải tài xế đang giữ đơn này');
    }
    if (!DRIVER_ACCEPTABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Chỉ có thể trả đơn khi đơn ở trạng thái Đã xác nhận, Đang chuẩn bị hoặc Sẵn sàng lấy món',
      );
    }

    // Đếm số lần trả đơn trong ngày hôm nay (giờ VN)
    const startOfToday = statsRangeStart(new Date(), 1, VN_OFFSET_MINUTES);
    const releasesToday = await this.prisma.auditLog.count({
      where: {
        actorId: driverId,
        action: 'DRIVER_RELEASE_ORDER',
        createdAt: { gte: startOfToday },
      },
    });
    if (releasesToday >= 3) {
      throw new ConflictException('Bạn đã trả quá nhiều đơn hôm nay, liên hệ hỗ trợ');
    }

    const cleanReason = reason.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, driverId, status: { in: DRIVER_ACCEPTABLE_STATUSES } },
        data: { driverId: null },
      });
      if (count === 0) {
        throw new ConflictException('Trạng thái đơn đã thay đổi, không thể trả đơn');
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: order.status,
          changedBy: driverId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: driverId,
          action: 'DRIVER_RELEASE_ORDER',
          targetType: 'ORDER',
          targetId: orderId,
          metadata: { reason: cleanReason, status: order.status },
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    this.gateway.emitOrderAvailable(updated);
    this.notifications.notifyDriverReleased(updated);
    return updated;
  }

  /** C5: Tài xế xác nhận đã đến điểm giao hàng (<= ARRIVAL_MAX_DISTANCE_M) */
  async markDriverArrived(orderId: string, driverId: string, dto: DriverArrivedDto): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Bạn không phải tài xế của đơn hàng này');
    }
    if (order.status !== 'PICKED_UP') {
      throw new BadRequestException('Chỉ có thể xác nhận đến điểm giao khi đơn đang ở trạng thái Đang giao (PICKED_UP)');
    }

    const maxDistanceM = Number(this.config.get<number>('business.arrivalMaxDistanceM') ?? 200);
    const distMeters = Math.round(
      haversineKm(
        { lat: dto.lat, lng: dto.lng },
        { lat: order.deliveryLat, lng: order.deliveryLng },
      ) * 1000,
    );

    if (distMeters > maxDistanceM) {
      throw new ConflictException(
        `Vị trí của bạn còn cách điểm giao khoảng ${distMeters}m (yêu cầu trong phạm vi ${maxDistanceM}m)`,
      );
    }

    if (order.arrivedAt) {
      return order;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { arrivedAt: new Date() },
      include: ORDER_DETAIL_INCLUDE,
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    this.notifications.notifyDriverArrived(updated);
    return updated;
  }

  /** C5: Ghi nhận lần gọi điện liên hệ khách hàng (giới hạn 1 lần / 30 giây) */
  async recordContactAttempt(orderId: string, driverId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Bạn không phải tài xế của đơn hàng này');
    }
    if (order.status !== 'PICKED_UP') {
      throw new BadRequestException('Chỉ ghi nhận liên hệ khách khi đang trong quá trình giao hàng (PICKED_UP)');
    }

    const latest = await this.prisma.deliveryContactAttempt.findFirst({
      where: { orderId, driverId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest && Date.now() - latest.createdAt.getTime() < 30_000) {
      const waitSec = Math.ceil((30_000 - (Date.now() - latest.createdAt.getTime())) / 1000);
      throw new ConflictException(
        `Vui lòng chờ ${waitSec} giây trước khi ghi nhận lần liên hệ tiếp theo`,
      );
    }

    const attempt = await this.prisma.deliveryContactAttempt.create({
      data: {
        orderId,
        driverId,
      },
    });

    const totalCallsAfterArrived = order.arrivedAt
      ? await this.prisma.deliveryContactAttempt.count({
          where: { orderId, driverId, createdAt: { gte: order.arrivedAt } },
        })
      : await this.prisma.deliveryContactAttempt.count({
          where: { orderId, driverId },
        });

    return { attempt, totalCallsAfterArrived };
  }

  /** Kiểm tra điều kiện nhận đơn: tài khoản hoạt động, hồ sơ APPROVED, đang trực tuyến và công nợ COD trong hạn mức */
  async assertDriverCanAccept(driverId: string, orderDebtToAdd = 0) {
    const user = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException('Tài khoản tài xế của bạn đang bị khoá');
    }
    const profile = user.driverProfile;
    if (!profile || profile.verificationStatus === 'PENDING') {
      throw new BadRequestException(
        'Hồ sơ tài xế của bạn đang chờ phê duyệt. Vui lòng cập nhật thông tin xe và đợi duyệt.',
      );
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

    const debtLimit = Number(this.config.get<number>('business.driverDebtLimit') ?? 2000000);
    if (
      profile.codBalance + orderDebtToAdd > debtLimit ||
      (orderDebtToAdd === 0 && profile.codBalance >= debtLimit)
    ) {
      throw new ForbiddenException(
        `Công nợ tiền mặt đã chạm hạn mức ${debtLimit.toLocaleString('vi-VN')}đ. Vui lòng nộp tiền để tiếp tục nhận đơn.`,
      );
    }

    return profile;
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
    return this.paginate({ restaurantId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  findForDriver(driverId: string, q: ListOrdersQueryDto) {
    return this.paginate({ driverId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async findAvailableForDrivers(driverId: string, q: ListOrdersQueryDto) {
    await this.assertDriverCanAccept(driverId);
    return this.paginate({ driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES } }, q, 'asc');
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
        OR: [
          { createdAt: { gte: start } },
          {
            status: OrderStatus.DELIVERED,
            statusHistory: {
              some: { status: OrderStatus.DELIVERED, createdAt: { gte: start } },
            },
          },
        ],
      },
      select: {
        status: true,
        deliveryFee: true,
        driverEarning: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        statusHistory: {
          where: { status: OrderStatus.DELIVERED },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const mapped = orders.map((o) => ({
      status: o.status,
      deliveryFee: o.deliveryFee,
      driverEarning: o.driverEarning,
      total: o.total,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      deliveredAt: o.statusHistory[0]?.createdAt ?? o.createdAt,
    }));

    return buildDriverStats(mapped, now, days);
  }

  // =========================================================================
  //  ĐÁNH GIÁ — khách chấm điểm quán sau khi nhận hàng
  // =========================================================================
  async review(orderId: string, customerId: string, rating: number, comment?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Chỉ đánh giá được đơn đã giao thành công');

    const where = { customerId, restaurantId: order.restaurantId };
    const [reviews, delivered] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.order.count({ where: { ...where, status: 'DELIVERED' } }),
    ]);
    if (reviews >= delivered) throw new ConflictException('Bạn đã đánh giá đơn hàng này rồi');

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { ...where, orderId: order.id, rating, comment: comment?.trim() || null },
      });
      const { _avg, _count } = await tx.review.aggregate({
        where: { restaurantId: order.restaurantId, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          rating: Math.round((_avg.rating ?? rating) * 10) / 10,
          ratingCount: _count.rating,
        },
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
        restaurant: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            address: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
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
