import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateOrderDto,
  DriverArrivedDto,
  ListOrdersQueryDto,
  QuoteOrderDto,
  ReleaseOrderDto,
  ReviewOrderDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrderPricingService } from './order-pricing.service';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly orderPricing: OrderPricingService,
  ) {}

  @Roles(Role.CUSTOMER)
  @Post('quote')
  quote(@CurrentUser('id') userId: string, @Body() dto: QuoteOrderDto) {
    return this.orderPricing.quote(userId, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
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
}
