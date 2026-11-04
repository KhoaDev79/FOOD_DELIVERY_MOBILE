import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { formatRetryAfter } from '../../common/rate-limit/rate-limit.util';
import { RATE_LIMIT_POLICIES } from '../../common/rate-limit/rate-limit.policies';
import { normalizeVoucherCode, VOUCHER_NOT_FOUND_REASON } from '../vouchers/voucher-rules';
import {
  CreateOrderDto,
  DriverArrivedDto,
  ListOrdersQueryDto,
  QuoteOrderDto,
  ReleaseOrderDto,
  ReviewOrderDto,
  SendOrderMessageDto,
  ChatChannelDto,
  ConversationsQueryDto,
  UpdateOrderStatusDto,
  ListRefundsQueryDto,
  ConfirmRefundDto,
} from './dto/orders.dto';
import { OrderPricingService } from './order-pricing.service';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly orderPricing: OrderPricingService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Roles(Role.CUSTOMER)
  @RateLimit('ORDER_QUOTE')
  @Post('quote')
  async quote(@CurrentUser('id') userId: string, @Body() dto: QuoteOrderDto) {
    // Báo sớm ở màn Thanh toán nếu khách đang bị tạm hạn chế vì huỷ nhiều
    const cancelStatus = await this.orders.getCustomerCancelStatus(userId);
    if (cancelStatus.restricted) {
      throw new ForbiddenException({ code: 'CANCEL_LIMIT', message: cancelStatus.warning });
    }
    return this.quoteWithVoucherGuard(userId, dto);
  }

  /**
   * Chống dò mã voucher: đếm các mã KHÁC NHAU không tồn tại. Chạm giới hạn thì tạm bỏ qua mọi mã khách nhập
   * (vẫn trả báo giá không giảm để khách đặt được đơn), không trả lỗi cả màn Thanh toán.
   */
  private async quoteWithVoucherGuard(userId: string, dto: QuoteOrderDto) {
    const codes = [...new Set((dto.voucherCodes ?? []).map(normalizeVoucherCode).filter(Boolean))];
    const lock = this.rateLimit.status('VOUCHER_INVALID', userId);
    if (lock.blocked && codes.length > 0) {
      const quote = await this.orderPricing.quote(userId, { ...dto, voucherCodes: [] });
      const reason = RATE_LIMIT_POLICIES.VOUCHER_INVALID.message(formatRetryAfter(lock.retryAfterMs));
      return { ...quote, rejectedVouchers: codes.map((code) => ({ code, reason })) };
    }
    const quote = await this.orderPricing.quote(userId, dto);
    for (const r of quote.rejectedVouchers ?? []) {
      if (r.reason === VOUCHER_NOT_FOUND_REASON) this.rateLimit.record('VOUCHER_INVALID', userId, r.code);
    }
    return quote;
  }

  /** Thông tin cho hộp thoại huỷ đơn: lý do, lời nhắc khi huỷ nhiều */
  @Roles(Role.CUSTOMER)
  @Get(':id/cancel-info')
  cancelInfo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.orders.getCancelInfo(id, userId);
  }

  @Roles(Role.CUSTOMER)
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Đếm theo idempotency-key: app gửi lại cùng một đơn (mạng chập chờn) không bị tính thêm lượt
    this.rateLimit.consume('ORDER_CREATE', userId, idempotencyKey || undefined);
    return this.orders.create(userId, dto, idempotencyKey);
  }

  @Roles(Role.CUSTOMER)
  @Get('my')
  mine(@CurrentUser('id') userId: string, @Query() q: ListOrdersQueryDto) {
    return this.orders.findForCustomer(userId, q);
  }

  @Roles(Role.DRIVER)
  @Get('available')
  available(@CurrentUser('id') driverId: string, @Query() q: ListOrdersQueryDto) {
    return this.orders.findAvailableForDrivers(driverId, q);
  }

  @Roles(Role.DRIVER)
  @Get('deliveries')
  deliveries(@CurrentUser('id') userId: string, @Query() q: ListOrdersQueryDto) {
    return this.orders.findForDriver(userId, q);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get('restaurant/:restaurantId')
  forRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: AuthUser,
    @Query() q: ListOrdersQueryDto,
  ) {
    return this.orders.findForRestaurant(restaurantId, user, q);
  }

  @Roles(Role.DRIVER)
  @Get('driver/stats')
  driverStats(@CurrentUser('id') userId: string, @Query('days') days?: string) {
    const parsedDays = Number(days ?? 7);
    return this.orders.getDriverStats(userId, parsedDays);
  }

  /** GET /orders/messages/conversations – hộp thư: các cuộc trò chuyện kèm thông tin đơn (đặt trước ':id'). */
  @Get('messages/conversations')
  conversations(@CurrentUser() user: AuthUser, @Query() q: ConversationsQueryDto) {
    return this.orders.listConversations(user, q.page, q.limit);
  }

  /** GET /orders/messages/unread – tin nhắn chưa đọc theo từng đơn (đặt trước ':id'). */
  @Get('messages/unread')
  unreadMessages(@CurrentUser() user: AuthUser) {
    return this.orders.getUnreadMessages(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, user, dto);
  }

  /** POST /orders/:id/review – khách chấm điểm quán và tài xế (1–5 sao) cho đơn đã giao. */
  @Roles(Role.CUSTOMER)
  @Post(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewOrderDto,
  ) {
    return this.orders.review(id, userId, dto);
  }

  @Roles(Role.DRIVER)
  @Post(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') driverId: string) {
    return this.orders.acceptByDriver(id, driverId);
  }

  @Roles(Role.DRIVER)
  @Post(':id/release')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: ReleaseOrderDto,
  ) {
    return this.orders.releaseByDriver(id, driverId, dto.reason);
  }

  @Roles(Role.DRIVER)
  @Post(':id/arrived')
  arrived(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: DriverArrivedDto,
  ) {
    return this.orders.markDriverArrived(id, driverId, dto);
  }

  @Roles(Role.DRIVER)
  @Post(':id/contact-attempts')
  contactAttempt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') driverId: string) {
    return this.orders.recordContactAttempt(id, driverId);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() q: ChatChannelDto,
  ) {
    return this.orders.getOrderMessages(id, user, q.channel);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.orders.sendOrderMessage(id, user, dto.channel, dto.content);
  }

  /** POST /orders/:id/messages/read – đánh dấu đã đọc tin nhắn của đơn. */
  @Post(':id/messages/read')
  @HttpCode(HttpStatus.OK)
  markMessagesRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatChannelDto,
  ) {
    return this.orders.markMessagesRead(id, user, dto.channel);
  }
}

/** Admin xử lý hoàn tiền thủ công cho đơn đã thanh toán online bị huỷ / giao thất bại */
@Roles(Role.ADMIN)
@Controller('admin/refunds')
export class AdminRefundsController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() q: ListRefundsQueryDto) {
    return this.orders.listRefunds(q.status ?? 'pending');
  }

  @Post(':orderId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ConfirmRefundDto,
  ) {
    return this.orders.confirmRefund(orderId, adminId, dto.note);
  }
}
