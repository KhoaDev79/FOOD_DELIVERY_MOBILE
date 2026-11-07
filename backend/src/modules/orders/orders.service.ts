import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatChannel,
  FailedDeliveryReason,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { boundingBox, haversineKm } from '../../common/utils/geo.util';
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
  ReviewOrderDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { canViewOrder, isPhoneHidden } from './order-access';
import {
  canParticipate,
  canReadChannel,
  CHANNEL_SIDES,
  sidesOf,
  channelHasDriver,
  channelIsOpen,
  channelRecipients,
  senderSideIn,
} from './order-chat';
import { VouchersService } from '../vouchers/vouchers.service';
import { MediaService } from '../media/media.service';
import {
  CancelLimitConfig,
  CUSTOMER_CANCEL_REASONS,
  DEFAULT_CANCEL_LIMIT,
  evaluateCancelLimit,
} from './cancel-policy';
import { OrderPricingService } from './order-pricing.service';
import {
  actorMayTransition,
  DRIVER_ACCEPTABLE_STATUSES,
  isValidTransition,
  OrderActor,
  validateCancellationInput,
} from './order-state-machine';

export const ORDER_DETAIL_INCLUDE = {
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
  review: true,
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{
  include: typeof ORDER_DETAIL_INCLUDE;
}>;

const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

/**
 * Công nợ COD của tài xế cho một đơn = tiền thực thu của khách − thu nhập tài xế.
 * Không có voucher thì bằng tiền món + hoa hồng sàn (công thức cũ); có voucher thì phần giảm do sàn/quán bù.
 */
export const codDebtOf = (o: { total: number; driverEarning: number }) => o.total - o.driverEarning;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: OrdersGateway,
    private readonly restaurants: RestaurantsService,
    private readonly notifications: NotificationsService,
    private readonly orderPricing: OrderPricingService,
    private readonly vouchers: VouchersService,
    private readonly media: MediaService,
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

    // Yêu cầu tài khoản khách hàng phải có SĐT và Họ tên hợp lệ
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { phone: true, fullName: true },
    });
    if (!customer?.phone || customer.phone.trim().length < 9) {
      throw new BadRequestException(
        'Tài khoản chưa cập nhật số điện thoại. Vui lòng cập nhật số điện thoại trước khi đặt hàng.',
      );
    }
    if (!customer?.fullName || customer.fullName.trim().length < 2) {
      throw new BadRequestException('Tài khoản chưa cập nhật họ tên người nhận. Vui lòng cập nhật trước khi đặt hàng.');
    }

    // Khách tự huỷ quá nhiều đơn gần đây: tạm hạn chế đặt đơn mới
    const cancelStatus = await this.getCustomerCancelStatus(customerId);
    if (cancelStatus.restricted) {
      throw new ForbiddenException({ code: 'CANCEL_LIMIT', message: cancelStatus.warning });
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
      throw new ForbiddenException('Tài khoản tạm thời không thể đặt đơn tiền mặt, liên hệ hỗ trợ');
    }

    let order: OrderDetail;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const priced = await this.orderPricing.verifyAndPriceOrder(customerId, dto, tx);
        const discountVoucher = priced.appliedVouchers.find((a) => a.voucher.discountType !== 'FREE_SHIP');
        const freeshipVoucher = priced.appliedVouchers.find((a) => a.voucher.discountType === 'FREE_SHIP');

        const created = await tx.order.create({
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
            discountAmount: priced.quote.itemDiscount,
            shippingDiscount: priced.quote.shippingDiscount,
            restaurantDiscount: priced.restaurantDiscount,
            voucherId: discountVoucher?.voucher.id,
            voucherCode: discountVoucher?.voucher.code,
            freeshipVoucherId: freeshipVoucher?.voucher.id,
            freeshipVoucherCode: freeshipVoucher?.voucher.code,
            distanceKm: priced.quote.distanceKm,
            distanceSource: priced.quote.distanceSource,
            deliveryAddress: priced.deliveryAddress,
            deliveryLat: priced.deliveryLat,
            deliveryLng: priced.deliveryLng,
            estimatedDeliveryAt: priced.estimatedDeliveryAt,
            idempotencyKey: cleanIdemKey,
            note: dto.note,
            items: { create: priced.dbLines },
            statusHistory: {
              create: { status: 'PENDING', changedBy: customerId },
            },
          },
          include: ORDER_DETAIL_INCLUDE,
        });
        // Giữ lượt voucher trong cùng transaction: hết lượt thì huỷ toàn bộ việc tạo đơn
        await this.vouchers.redeem(tx, priced.appliedVouchers, customerId, created.id);
        return created;
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
  //  CHÍNH SÁCH HUỶ CỦA KHÁCH + HOÀN TIỀN
  // =========================================================================

  /** Số lần khách TỰ huỷ đơn gần đây và trạng thái hạn chế đặt đơn. */
  async getCustomerCancelStatus(customerId: string, now = new Date()) {
    const cfg: CancelLimitConfig = {
      windowDays: Number(this.config.get('CUSTOMER_CANCEL_WINDOW_DAYS') ?? DEFAULT_CANCEL_LIMIT.windowDays),
      warnAt: Number(this.config.get('CUSTOMER_CANCEL_WARN_AT') ?? DEFAULT_CANCEL_LIMIT.warnAt),
      limit: Number(this.config.get('CUSTOMER_CANCEL_LIMIT') ?? DEFAULT_CANCEL_LIMIT.limit),
    };
    const since = new Date(now.getTime() - cfg.windowDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { status: OrderStatus.CANCELLED, changedBy: customerId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return evaluateCancelLimit(
      rows.map((r) => r.createdAt),
      now,
      cfg,
    );
  }

  /** Thông tin cho hộp thoại huỷ đơn của khách: còn huỷ được không, các lý do, lời nhắc nếu huỷ nhiều. */
  async getCancelInfo(orderId: string, customerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, status: true, paymentStatus: true },
    });
    if (!order || order.customerId !== customerId) throw new NotFoundException('Không tìm thấy đơn hàng');
    const status = await this.getCustomerCancelStatus(customerId);
    const canCancel = order.status === OrderStatus.PENDING;
    return {
      canCancel,
      reason: canCancel
        ? undefined
        : ['CANCELLED', 'DELIVERY_FAILED', 'DELIVERED'].includes(order.status)
          ? 'Đơn hàng đã kết thúc nên không thể huỷ.'
          : 'Quán đã nhận đơn nên bạn không tự huỷ được. Hãy gửi yêu cầu hỗ trợ để nhân viên liên hệ quán.',
      reasons: CUSTOMER_CANCEL_REASONS,
      cancelCount: status.count,
      limit: status.limit,
      windowDays: status.windowDays,
      warning: status.warning,
      refundNotice: order.paymentStatus === 'PAID' ? 'Tiền đã thanh toán online sẽ được hoàn trong 3–7 ngày làm việc.' : undefined,
    };
  }

  /** Admin: danh sách đơn đã thanh toán online cần hoàn tiền / đã hoàn. */
  async listRefunds(status: 'pending' | 'done') {
    return this.prisma.order.findMany({
      where: { paymentStatus: status === 'pending' ? 'REFUND_PENDING' : 'REFUNDED' },
      orderBy: status === 'pending' ? { updatedAt: 'asc' } : { refundedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        cancelReason: true,
        failedReason: true,
        cancelNote: true,
        refundedAt: true,
        refundNote: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { id: true, fullName: true, phone: true } },
        restaurant: { select: { id: true, name: true } },
        transactions: { where: { status: 'SUCCESS' }, select: { txnRef: true, providerTxnNo: true, amount: true, bankCode: true } },
      },
    });
  }

  /** Admin xác nhận đã hoàn tiền thủ công (VNPay sandbox không gọi API hoàn tiền thật). */
  async confirmRefund(orderId: string, adminId: string, note: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: 'REFUND_PENDING' },
        data: { paymentStatus: 'REFUNDED', refundedAt: new Date(), refundNote: note.trim() },
      });
      if (count === 0) throw new ConflictException('Đơn không ở trạng thái chờ hoàn tiền');
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ORDER_REFUND_CONFIRMED',
          targetType: 'ORDER',
          targetId: orderId,
          metadata: { note: note.trim() },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, customerId: true, total: true } });
    });
    void this.notifications.sendToUsers([updated.customerId], {
      title: 'Đã hoàn tiền đơn hàng',
      body: `ZomZom đã hoàn ${updated.total.toLocaleString('vi-VN')} ₫ cho đơn #${orderId.slice(0, 8).toUpperCase()}. Tiền về tài khoản trong 3–7 ngày làm việc tuỳ ngân hàng.`,
      data: { type: 'order', orderId },
    });
    return updated;
  }

  // =========================================================================
  //  CẬP NHẬT TRẠNG THÁI — state machine + lý do huỷ + công nợ COD + giao thất bại
  // =========================================================================
  async updateStatus(
    orderId: string,
    userOrSystem: AuthUser | 'SYSTEM',
    dto: UpdateOrderStatusDto | OrderStatus,
  ): Promise<OrderDetail> {
    const payload: UpdateOrderStatusDto = typeof dto === 'string' ? { status: dto } : dto;
    const to = payload.status;

    const order = await this.getOrderOrThrow(orderId);
    const actor: OrderActor | null = userOrSystem === 'SYSTEM' ? 'SYSTEM' : this.resolveActor(order, userOrSystem);
    const changedBy: string | null = userOrSystem === 'SYSTEM' ? null : userOrSystem.id;

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
        throw new ConflictException('Bạn cần xác nhận đã đến điểm giao hàng trước khi báo giao thất bại');
      }
      const minWaitMinutes = Number(this.config.get<number>('business.failedDeliveryMinWaitMinutes') ?? 10);
      const elapsedMs = Date.now() - order.arrivedAt.getTime();
      const requiredMs = minWaitMinutes * 60 * 1000;
      if (elapsedMs < requiredMs) {
        const remainingMin = Math.max(1, Math.ceil((requiredMs - elapsedMs) / 60000));
        throw new ConflictException(`Cần chờ thêm ${remainingMin} phút`);
      }

      if (payload.failedReason === FailedDeliveryReason.CUSTOMER_UNREACHABLE) {
        const minCalls = Number(this.config.get<number>('business.failedDeliveryMinCalls') ?? 3);
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
          ...(to === 'DELIVERED' && order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' as const } : {}),
          ...(to === 'CANCELLED'
            ? {
                cancelReason: payload.cancelReason,
                cancelNote: payload.cancelNote?.trim() || null,
                cancelledById: changedBy,
                // Đã trả online: chưa hoàn thật nên chỉ ghi "chờ hoàn tiền", admin xác nhận khi đã hoàn
                ...(order.paymentStatus === 'PAID' ? { paymentStatus: 'REFUND_PENDING' as const } : {}),
              }
            : {}),
          ...(to === 'DELIVERY_FAILED'
            ? {
                failedReason: payload.failedReason,
                cancelNote: payload.cancelNote?.trim() || null,
                ...(order.paymentStatus === 'PAID' ? { paymentStatus: 'REFUND_PENDING' as const } : {}),
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

      // Đơn không thành: trả lại lượt voucher cho khách
      if (to === 'CANCELLED' || to === 'DELIVERY_FAILED') {
        await this.vouchers.releaseForOrder(tx, orderId);
      }

      // C4: Ghi công nợ COD khi giao thành công (cùng transaction)
      if (to === 'DELIVERED' && order.paymentMethod === 'COD' && order.driverId) {
        const debtAmount = codDebtOf(order);
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

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    if (to === 'CONFIRMED' && !updated.driverId) {
      void this.dispatchOrderAvailable(updated);
    }
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
      select: { id: true, total: true, driverEarning: true },
    });
    if (!targetOrder) throw new NotFoundException('Không tìm thấy đơn hàng');

    const orderDebt = codDebtOf(targetOrder);
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
      where: {
        id: orderId,
        driverId: null,
        status: { in: DRIVER_ACCEPTABLE_STATUSES },
      },
      data: { driverId },
    });
    if (count === 0) {
      throw new ConflictException('Đơn đã có tài xế khác nhận hoặc không còn khả dụng');
    }

    const order = await this.getOrderOrThrow(orderId);
    this.gateway.emitOrderUpdated('order:driver_assigned', order);
    this.gateway.emitOrderTaken(order.id);
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
        where: {
          id: orderId,
          driverId,
          status: { in: DRIVER_ACCEPTABLE_STATUSES },
        },
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

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    void this.dispatchOrderAvailable(updated);
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
      throw new BadRequestException(
        'Chỉ có thể xác nhận đến điểm giao khi đơn đang ở trạng thái Đang giao (PICKED_UP)',
      );
    }

    const maxDistanceM = Number(this.config.get<number>('business.arrivalMaxDistanceM') ?? 200);
    const distMeters = Math.round(
      haversineKm({ lat: dto.lat, lng: dto.lng }, { lat: order.deliveryLat, lng: order.deliveryLng }) * 1000,
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
      throw new ConflictException(`Vui lòng chờ ${waitSec} giây trước khi ghi nhận lần liên hệ tiếp theo`);
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
    if (profile.codBalance + orderDebtToAdd > debtLimit || (orderDebtToAdd === 0 && profile.codBalance >= debtLimit)) {
      throw new ForbiddenException(
        `Công nợ tiền mặt đã chạm hạn mức ${debtLimit.toLocaleString('vi-VN')}đ. Vui lòng nộp tiền để tiếp tục nhận đơn.`,
      );
    }

    return profile;
  }

  // =========================================================================
  //  TRUY VẤN
  // =========================================================================
  async findOne(orderId: string, user: AuthUser) {
    const order = await this.getOrderOrThrow(orderId);
    // Trả 404 thay vì 403 để không lộ sự tồn tại của đơn
    if (!canViewOrder(order, user)) throw new NotFoundException('Không tìm thấy đơn hàng');

    const driverLocProfile = order.driver?.driverProfile;
    const driverLocation =
      driverLocProfile &&
      typeof driverLocProfile.lastLatitude === 'number' &&
      typeof driverLocProfile.lastLongitude === 'number'
        ? {
            lat: driverLocProfile.lastLatitude,
            lng: driverLocProfile.lastLongitude,
            at: driverLocProfile.lastLocationAt ? driverLocProfile.lastLocationAt.toISOString() : null,
          }
        : null;

    // E2: Ẩn số điện thoại khách và tài xế khi đơn đã kết thúc quá 2 giờ (trừ ADMIN)
    const terminalHistory = [...(order.statusHistory ?? [])].reverse().find((h) => h.status === order.status);
    const finishedAt = terminalHistory?.createdAt ?? order.updatedAt;
    const shouldMaskPhone = user.role !== 'ADMIN' && isPhoneHidden(order.status, finishedAt);

    // E3: Tính canReview cho khách hàng trong thời hạn REVIEW_WINDOW_DAYS kể từ lúc giao
    const reviewWindowDays = Number(this.config.get<number>('business.reviewWindowDays') ?? 7);
    const deliveredHistory = [...(order.statusHistory ?? [])].reverse().find((h) => h.status === 'DELIVERED');
    const deliveredAt = deliveredHistory?.createdAt ?? order.updatedAt;
    const withinReviewWindow = Date.now() - deliveredAt.getTime() <= reviewWindowDays * 24 * 60 * 60 * 1000;
    const canReview =
      order.status === 'DELIVERED' && !order.review && withinReviewWindow && order.customerId === user.id;

    return {
      ...order,
      customer: shouldMaskPhone ? { ...order.customer, phone: null } : order.customer,
      driver: order.driver && shouldMaskPhone ? { ...order.driver, phone: null } : order.driver,
      driverLocation,
      canReview,
    };
  }

  findForCustomer(customerId: string, q: ListOrdersQueryDto) {
    return this.paginate({ customerId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async findForRestaurant(restaurantId: string, user: AuthUser, q: ListOrdersQueryDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.paginate({ restaurantId, ...(q.status ? { status: q.status } : {}) }, q, 'desc', user.role === 'ADMIN');
  }

  findForDriver(driverId: string, q: ListOrdersQueryDto) {
    return this.paginate({ driverId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  /**
   * D3: Lấy danh sách đơn khả dụng cho tài xế trong bán kính DRIVER_SEARCH_RADIUS_KM.
   * - Yêu cầu vị trí tài xế còn mới (lastLocationAt trong DRIVER_LOCATION_STALE_MINUTES).
   * - Lọc theo bounding box + Haversine <= DRIVER_SEARCH_RADIUS_KM.
   * - Sắp xếp theo khoảng cách tài xế -> quán tăng dần, rồi theo thời gian chờ (createdAt tăng dần).
   * - Bổ sung distanceToRestaurantKm, deliveryDistanceKm, driverEarning, codToCollect, debtAfterAccept.
   */
  async findAvailableForDrivers(driverId: string, q: ListOrdersQueryDto) {
    const profile = await this.assertDriverCanAccept(driverId);

    const staleMinutes = Number(this.config.get<number>('business.driverLocationStaleMinutes') ?? 5);
    if (
      profile.lastLatitude === null ||
      profile.lastLongitude === null ||
      !profile.lastLocationAt ||
      Date.now() - profile.lastLocationAt.getTime() > staleMinutes * 60 * 1000
    ) {
      throw new ConflictException('Không xác định được vị trí của bạn, hãy bật định vị');
    }

    const radiusKm = Number(this.config.get<number>('business.driverSearchRadiusKm') ?? 5);
    const driverPos = { lat: profile.lastLatitude, lng: profile.lastLongitude };
    const box = boundingBox(driverPos, radiusKm);

    const rows = await this.prisma.order.findMany({
      where: {
        driverId: null,
        status: { in: DRIVER_ACCEPTABLE_STATUSES },
        restaurant: {
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
        },
      },
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
        // Đơn chưa nhận: không lộ số điện thoại khách cho mọi tài xế quanh đó (chỉ có sau khi nhận đơn)
        customer: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const matched = rows
      .map((row) => {
        const distKm = haversineKm(driverPos, {
          lat: row.restaurant.latitude,
          lng: row.restaurant.longitude,
        });
        return {
          ...row,
          distanceToRestaurantKm: Math.round(distKm * 100) / 100,
          deliveryDistanceKm: row.distanceKm,
          driverEarning: row.driverEarning,
          codToCollect: row.total,
          debtAfterAccept: profile.codBalance + codDebtOf(row),
          _rawDistKm: distKm,
        };
      })
      .filter((item) => item._rawDistKm <= radiusKm)
      .sort((a, b) => {
        if (a.distanceToRestaurantKm !== b.distanceToRestaurantKm) {
          return a.distanceToRestaurantKm - b.distanceToRestaurantKm;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map(({ _rawDistKm: _unused, ...rest }) => rest);

    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const offset = (page - 1) * limit;

    return {
      items: matched.slice(offset, offset + limit),
      page,
      limit,
      hasMore: matched.length > offset + limit,
    };
  }

  /**
   * D3: Điều phối phát đơn khả dụng cho các tài xế hợp lệ trong bán kính:
   * - Đang trực tuyến (isOnline = true), hồ sơ APPROVED, tài khoản active
   * - Vị trí còn mới trong DRIVER_LOCATION_STALE_MINUTES
   * - Nằm trong bán kính DRIVER_SEARCH_RADIUS_KM * radiusMultiplier
   * - Công nợ sau khi nhận <= DRIVER_DEBT_LIMIT
   * - Số đơn đang giao < DRIVER_MAX_ACTIVE_ORDERS
   */
  async dispatchOrderAvailable(order: OrderDetail, radiusMultiplier = 1): Promise<string[]> {
    try {
      const baseRadiusKm = Number(this.config.get<number>('business.driverSearchRadiusKm') ?? 5);
      const radiusKm = baseRadiusKm * radiusMultiplier;
      const staleMinutes = Number(this.config.get<number>('business.driverLocationStaleMinutes') ?? 5);
      const debtLimit = Number(this.config.get<number>('business.driverDebtLimit') ?? 2000000);
      const maxActive = Number(this.config.get<number>('business.driverMaxActiveOrders') ?? 2);

      const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
      const orderDebt = codDebtOf(order);
      const restPos = {
        lat: order.restaurant.latitude,
        lng: order.restaurant.longitude,
      };
      const box = boundingBox(restPos, radiusKm);

      const candidates =
        (await this.prisma.driverProfile?.findMany?.({
          where: {
            isOnline: true,
            verificationStatus: 'APPROVED',
            lastLocationAt: { gte: staleCutoff },
            lastLatitude: { gte: box.minLat, lte: box.maxLat },
            lastLongitude: { gte: box.minLng, lte: box.maxLng },
            codBalance: { lte: debtLimit - orderDebt },
            user: { isActive: true },
          },
          select: {
            userId: true,
            lastLatitude: true,
            lastLongitude: true,
            codBalance: true,
          },
        })) ?? [];

      const inRadius = candidates
        .filter((c) => c.lastLatitude !== null && c.lastLongitude !== null)
        .map((c) => {
          const distKm = haversineKm({ lat: c.lastLatitude!, lng: c.lastLongitude! }, restPos);
          return { ...c, distKm };
        })
        .filter((c) => c.distKm <= radiusKm);

      if (inRadius.length === 0) {
        return [];
      }

      // Kiểm tra số đơn đang giao của từng tài xế ứng viên
      const activeOrders =
        (await this.prisma.order.findMany({
          where: {
            driverId: { in: inRadius.map((c) => c.userId) },
            status: { in: ACTIVE_DELIVERY_STATUSES },
          },
          select: { driverId: true },
        })) ?? [];

      const activeCounts = new Map<string, number>();
      for (const ao of activeOrders) {
        if (ao.driverId) {
          activeCounts.set(ao.driverId, (activeCounts.get(ao.driverId) ?? 0) + 1);
        }
      }

      const eligible = inRadius.filter((c) => (activeCounts.get(c.userId) ?? 0) < maxActive);
      if (eligible.length === 0) {
        return [];
      }

      for (const drv of eligible) {
        const payload = {
          ...order,
          // Chưa nhận đơn thì chưa được biết số điện thoại khách
          customer: { ...order.customer, phone: null },
          distanceToRestaurantKm: Math.round(drv.distKm * 100) / 100,
          deliveryDistanceKm: order.distanceKm,
          driverEarning: order.driverEarning,
          codToCollect: order.total,
          debtAfterAccept: drv.codBalance + orderDebt,
        };
        this.gateway.emitOrderAvailableToDriver(drv.userId, payload);
      }

      const eligibleIds = eligible.map((e) => e.userId);
      void this.notifications.notifyDriversOrderAvailable(eligibleIds, order);
      return eligibleIds;
    } catch {
      return [];
    }
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
              some: {
                status: OrderStatus.DELIVERED,
                createdAt: { gte: start },
              },
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
  //  ĐÁNH GIÁ — E3: khách chấm điểm quán + tài xế theo từng đơn trong REVIEW_WINDOW_DAYS
  // =========================================================================
  async review(orderId: string, customerId: string, dtoOrRating: ReviewOrderDto | number, legacyComment?: string) {
    const dto: ReviewOrderDto =
      typeof dtoOrRating === 'number' ? { rating: dtoOrRating, comment: legacyComment } : dtoOrRating;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        review: true,
        statusHistory: {
          where: { status: OrderStatus.DELIVERED },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Chỉ đánh giá được đơn đã giao thành công');
    }
    if (order.review) {
      throw new ConflictException('Bạn đã đánh giá đơn này');
    }

    const reviewWindowDays = Number(this.config.get<number>('business.reviewWindowDays') ?? 7);
    const deliveredAt = order.statusHistory?.[0]?.createdAt ?? order.updatedAt;
    if (deliveredAt && Date.now() - deliveredAt.getTime() > reviewWindowDays * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`Đã quá thời hạn đánh giá đơn hàng (tối đa ${reviewWindowDays} ngày sau khi giao)`);
    }

    const hasDriver = Boolean(order.driverId);

    // Tải ảnh lên trước (ngoài transaction vì gọi mạng); ảnh lỗi thì bỏ qua thay vì làm hỏng cả đánh giá
    const images = (
      await Promise.all(
        (dto.images ?? []).slice(0, 3).map((img) => this.media.resolveImage(img, 'reviews').catch(() => null)),
      )
    ).filter((u): u is string => Boolean(u));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            orderId: order.id,
            customerId,
            restaurantId: order.restaurantId,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
            images,
            driverId: hasDriver ? order.driverId : null,
            driverRating: hasDriver && dto.driverRating ? dto.driverRating : null,
            driverComment: hasDriver && dto.driverComment ? dto.driverComment.trim() || null : null,
          },
        });
        const { _avg, _count } = await tx.review.aggregate({
          where: { restaurantId: order.restaurantId, isHidden: false },
          _avg: { rating: true },
          _count: { rating: true },
        });
        await tx.restaurant.update({
          where: { id: order.restaurantId },
          data: {
            rating: (_count.rating ?? 0) > 0 ? Math.round((_avg.rating ?? dto.rating) * 10) / 10 : 0,
            ratingCount: _count.rating ?? 1,
          },
        });
        return review;
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Bạn đã đánh giá đơn này');
      }
      throw err;
    }
  }

  // =========================================================================
  //  CHAT THEO ĐƠN — 3 cuộc trò chuyện riêng 2 bên (xem order-chat.ts)
  // =========================================================================

  /** Lấy đơn và kiểm tra quyền dùng kênh. Không có quyền -> 404 để không lộ cuộc trò chuyện. */
  private async getChatOrder(orderId: string, user: AuthUser, channel: ChatChannel, mode: 'read' | 'write') {
    const order = await this.getOrderOrThrow(orderId);
    if (!canViewOrder(order, user)) throw new NotFoundException('Không tìm thấy đơn hàng');
    const allowed = mode === 'read' ? canReadChannel(order, user, channel) : canParticipate(order, user, channel);
    if (!allowed) {
      if (!channelIsOpen(order, channel)) {
        throw new BadRequestException('Đơn chưa có tài xế nên chưa thể nhắn tin với tài xế');
      }
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }
    return order;
  }

  /** Điều kiện lọc tin của một kênh: kênh có tài xế chỉ lấy tin với tài xế hiện tại của đơn. */
  private channelWhere(orderId: string, channel: ChatChannel, driverId: string | null): Prisma.OrderMessageWhereInput {
    return {
      orderId,
      channel,
      ...(channelHasDriver(channel) ? { driverId } : {}),
    };
  }

  async getOrderMessages(orderId: string, user: AuthUser, channel: ChatChannel) {
    const order = await this.getChatOrder(orderId, user, channel, 'read');
    return this.prisma.orderMessage.findMany({
      where: this.channelWhere(orderId, channel, order.driverId),
      include: {
        sender: {
          select: { id: true, fullName: true, avatarUrl: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendOrderMessage(orderId: string, user: AuthUser, channel: ChatChannel, rawContent: string) {
    const content = rawContent.trim();
    if (!content) throw new BadRequestException('Nội dung tin nhắn không được rỗng');
    if (content.length > 1000) throw new BadRequestException('Nội dung tin nhắn tối đa 1000 ký tự');

    const order = await this.getChatOrder(orderId, user, channel, 'write');
    const message = await this.prisma.orderMessage.create({
      data: {
        orderId,
        channel,
        driverId: channelHasDriver(channel) ? order.driverId : null,
        senderId: user.id,
        senderRole: user.role,
        content,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, avatarUrl: true, role: true },
        },
      },
    });

    // Người gửi đã "đọc" tới tin của chính mình
    await this.touchChatRead(orderId, user.id, channel, message.createdAt);

    // Chỉ bên còn lại của kênh nhận tin; bên thứ ba của đơn không nhận
    const recipientIds = channelRecipients(order, channel, user.id);
    this.gateway.emitOrderMessage(message, user.id, recipientIds);

    const side = senderSideIn(order, channel, user.id);
    const senderName =
      side === 'RESTAURANT'
        ? order.restaurant.name
        : side === 'DRIVER'
          ? order.driver?.fullName || 'Tài xế'
          : order.customer?.fullName || 'Khách hàng';
    const senderRoleLabel =
      side === 'RESTAURANT'
        ? 'Quán ăn'
        : side === 'DRIVER'
          ? 'Tài xế giao hàng'
          : 'Khách hàng';
    if (recipientIds.length > 0) {
      void this.notifications.sendToUsers(recipientIds, {
        title: `Tin nhắn mới từ ${senderName}`,
        body: content,
        data: {
          type: 'order_chat',
          orderId,
          channel,
          recipientName: senderName,
          recipientRole: senderRoleLabel,
        },
      });
    }
    return message;
  }

  /** Đánh dấu đã đọc toàn bộ tin của một kênh tới thời điểm hiện tại. */
  async markMessagesRead(orderId: string, user: AuthUser, channel: ChatChannel) {
    await this.getChatOrder(orderId, user, channel, 'write');
    const lastReadAt = await this.touchChatRead(orderId, user.id, channel, new Date());
    void this.notifications?.markOrderChatNotificationsAsRead?.(user.id, orderId, channel);
    return { orderId, channel, lastReadAt };
  }

  /**
   * Tin chưa đọc của người dùng, gom theo (đơn, kênh): chỉ tin do bên còn lại gửi trong kênh
   * mà người này là một trong hai bên, gửi sau mốc đã đọc của kênh đó. Tối đa 20 cuộc mới nhất.
   */
  async getUnreadMessages(user: AuthUser) {
    if (user.role === 'ADMIN') return { totalUnread: 0, conversations: [] };
    const uid = user.id;

    const rows = await this.prisma.$queryRaw<
      {
        orderId: string;
        channel: ChatChannel;
        unread: number;
        id: string;
        content: string;
        createdAt: Date;
        senderId: string;
        senderRole: Role;
      }[]
    >`
      SELECT * FROM (
        SELECT DISTINCT ON (m."orderId", m.channel)
          m."orderId", m.channel, m.id, m.content, m."createdAt", m."senderId", m."senderRole",
          COUNT(*) OVER (PARTITION BY m."orderId", m.channel)::int AS unread
        FROM order_messages m
        JOIN orders o ON o.id = m."orderId"
        JOIN restaurants r ON r.id = o."restaurantId"
        LEFT JOIN order_chat_reads cr
          ON cr."orderId" = m."orderId" AND cr."userId" = ${uid}::uuid AND cr.channel = m.channel
        WHERE m."senderId" <> ${uid}::uuid
          AND (cr."lastReadAt" IS NULL OR m."createdAt" > cr."lastReadAt")
          AND ${this.chatParticipationSql(uid)}
        ORDER BY m."orderId", m.channel, m."createdAt" DESC
      ) t
      ORDER BY t."createdAt" DESC
      LIMIT 20
    `;
    if (rows.length === 0) return { totalUnread: 0, conversations: [] };

    const [senders, orders] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.senderId))] } },
        select: { id: true, fullName: true, role: true },
      }),
      this.prisma.order.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.orderId))] } },
        select: {
          id: true,
          status: true,
          restaurant: { select: { name: true } },
        },
      }),
    ]);
    const senderById = new Map(senders.map((s) => [s.id, s]));
    const orderById = new Map(orders.map((o) => [o.id, o]));

    const conversations = rows.map((r) => {
      const order = orderById.get(r.orderId);
      return {
        orderId: r.orderId,
        channel: r.channel,
        orderStatus: order?.status ?? null,
        restaurantName: order?.restaurant.name ?? null,
        unreadCount: r.unread,
        lastMessage: {
          id: r.id,
          content: r.content,
          createdAt: r.createdAt,
          senderRole: r.senderRole,
          sender: senderById.get(r.senderId) ?? {
            id: r.senderId,
            fullName: '',
            role: r.senderRole,
          },
        },
      };
    });
    return {
      totalUnread: rows.reduce((s, r) => s + r.unread, 0),
      conversations,
    };
  }

  /**
   * Điều kiện SQL: tin nhắn `m` (đơn `o`, quán `r`) thuộc cuộc trò chuyện mà người dùng là một
   * trong hai bên. Kênh có tài xế chỉ tính tin với tài xế hiện tại của đơn (khớp order-chat.ts).
   */
  private chatParticipationSql(uid: string): Prisma.Sql {
    return Prisma.sql`(
      (m.channel = 'CUSTOMER_DRIVER' AND m."driverId" = o."driverId"
        AND (o."customerId" = ${uid}::uuid OR o."driverId" = ${uid}::uuid))
      OR (m.channel = 'CUSTOMER_RESTAURANT'
        AND (o."customerId" = ${uid}::uuid OR r."ownerId" = ${uid}::uuid))
      OR (m.channel = 'RESTAURANT_DRIVER' AND m."driverId" = o."driverId"
        AND (r."ownerId" = ${uid}::uuid OR o."driverId" = ${uid}::uuid))
    )`;
  }

  /**
   * Hộp thư: mọi cuộc trò chuyện người dùng tham gia, mới nhất trước. Mỗi cuộc gồm người bên kia,
   * tin cuối, số tin chưa đọc và thông tin đơn (mã đơn, trạng thái, món, tổng tiền, khách, địa chỉ)
   * để chủ quán/tài xế biết rõ đang nói chuyện với khách nào về đơn nào.
   */
  async listConversations(user: AuthUser, page = 1, limit = 30) {
    if (user.role === 'ADMIN') return { items: [], page, limit, hasMore: false };
    const uid = user.id;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<
      {
        orderId: string;
        channel: ChatChannel;
        unread: number;
        id: string;
        content: string;
        createdAt: Date;
        senderId: string;
        senderRole: Role;
      }[]
    >`
      SELECT * FROM (
        SELECT DISTINCT ON (m."orderId", m.channel)
          m."orderId", m.channel, m.id, m.content, m."createdAt", m."senderId", m."senderRole",
          (COUNT(*) FILTER (
            WHERE m."senderId" <> ${uid}::uuid AND (cr."lastReadAt" IS NULL OR m."createdAt" > cr."lastReadAt")
          ) OVER (PARTITION BY m."orderId", m.channel))::int AS unread
        FROM order_messages m
        JOIN orders o ON o.id = m."orderId"
        JOIN restaurants r ON r.id = o."restaurantId"
        LEFT JOIN order_chat_reads cr
          ON cr."orderId" = m."orderId" AND cr."userId" = ${uid}::uuid AND cr.channel = m.channel
        WHERE ${this.chatParticipationSql(uid)}
        ORDER BY m."orderId", m.channel, m."createdAt" DESC
      ) t
      ORDER BY t."createdAt" DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `;
    const hasMore = rows.length > limit;
    const page_ = rows.slice(0, limit);
    if (page_.length === 0) return { items: [], page, limit, hasMore: false };

    const orders = await this.prisma.order.findMany({
      where: { id: { in: [...new Set(page_.map((r) => r.orderId))] } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        total: true,
        paymentMethod: true,
        deliveryAddress: true,
        customerId: true,
        driverId: true,
        items: { select: { name: true, quantity: true } },
        restaurant: {
          select: { id: true, name: true, imageUrl: true, ownerId: true },
        },
        customer: { select: { id: true, fullName: true, avatarUrl: true } },
        driver: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    const orderById = new Map(orders.map((o) => [o.id, o]));

    const items = page_.flatMap((r) => {
      const order = orderById.get(r.orderId);
      if (!order) return [];
      const mySides = sidesOf(order, uid);
      const otherSide = CHANNEL_SIDES[r.channel].find((side) => !mySides.includes(side)) ?? CHANNEL_SIDES[r.channel][1];
      const counterpart =
        otherSide === 'RESTAURANT'
          ? {
              side: otherSide,
              name: order.restaurant.name,
              avatarUrl: order.restaurant.imageUrl,
            }
          : otherSide === 'DRIVER'
            ? {
                side: otherSide,
                name: order.driver?.fullName ?? 'Tài xế',
                avatarUrl: order.driver?.avatarUrl ?? null,
              }
            : {
                side: otherSide,
                name: order.customer.fullName,
                avatarUrl: order.customer.avatarUrl,
              };
      return [
        {
          orderId: r.orderId,
          channel: r.channel,
          unreadCount: r.unread,
          counterpart,
          lastMessage: {
            id: r.id,
            content: r.content,
            createdAt: r.createdAt,
            senderRole: r.senderRole,
            isMine: r.senderId === uid,
          },
          order: {
            id: order.id,
            code: order.id.slice(0, 8).toUpperCase(),
            status: order.status,
            createdAt: order.createdAt,
            total: order.total,
            paymentMethod: order.paymentMethod,
            deliveryAddress: order.deliveryAddress,
            itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
            items: order.items.slice(0, 3),
            restaurant: {
              id: order.restaurant.id,
              name: order.restaurant.name,
              imageUrl: order.restaurant.imageUrl,
            },
            customer: {
              id: order.customer.id,
              fullName: order.customer.fullName,
            },
            driver: order.driver ? { id: order.driver.id, fullName: order.driver.fullName } : null,
          },
        },
      ];
    });
    return { items, page, limit, hasMore };
  }

  /** Dời mốc đã đọc của kênh lên `at` (không bao giờ lùi lại). */
  private async touchChatRead(orderId: string, userId: string, channel: ChatChannel, at: Date): Promise<Date> {
    const key = { orderId_userId_channel: { orderId, userId, channel } };
    const row = await this.prisma.orderChatRead.upsert({
      where: key,
      create: { orderId, userId, channel, lastReadAt: at },
      update: {},
    });
    if (row.lastReadAt < at) {
      await this.prisma.orderChatRead.update({
        where: key,
        data: { lastReadAt: at },
      });
      return at;
    }
    return row.lastReadAt;
  }

  // =========================================================================
  //  HELPERS
  // =========================================================================
  private async paginate(
    where: Prisma.OrderWhereInput,
    q: ListOrdersQueryDto,
    order: 'asc' | 'desc' = 'desc',
    viewerIsAdmin = false,
  ) {
    const reviewWindowDays = Number(this.config.get<number>('business.reviewWindowDays') ?? 7);
    const windowMs = reviewWindowDays * 24 * 60 * 60 * 1000;
    const rows = await this.prisma.order.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            note: true,
          },
        },
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
        review: true,
      },
      orderBy: { createdAt: order },
      skip: (q.page - 1) * q.limit,
      take: q.limit + 1,
    });
    const now = Date.now();
    const mapped = rows.slice(0, q.limit).map((r) => {
      // Danh sách không kèm lịch sử trạng thái: lấy updatedAt làm thời điểm kết thúc đơn
      const maskPhone = !viewerIsAdmin && isPhoneHidden(r.status, r.updatedAt);
      return {
        ...r,
        customer: maskPhone ? { ...r.customer, phone: null } : r.customer,
        driver: r.driver && maskPhone ? { ...r.driver, phone: null } : r.driver,
        canReview: r.status === 'DELIVERED' && !r.review && now - r.updatedAt.getTime() <= windowMs,
      };
    });
    return {
      items: mapped,
      page: q.page,
      limit: q.limit,
      hasMore: rows.length > q.limit,
    };
  }

  private async getOrderOrThrow(orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });
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
