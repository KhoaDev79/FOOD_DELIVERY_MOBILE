import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.orders.create(userId, dto);
  }

  @Roles(Role.CUSTOMER)
  @Get('my')
  mine(@CurrentUser('id') userId: string, @Query() q: ListOrdersQueryDto) {
    return this.orders.findForCustomer(userId, q);
  }

  @Roles(Role.DRIVER)
  @Get('available')
  available(@Query() q: ListOrdersQueryDto) {
    return this.orders.findAvailableForDrivers(q);
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
    return this.orders.updateStatus(id, user, dto.status);
  }

  @Roles(Role.DRIVER)
  @Post(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') driverId: string) {
    return this.orders.acceptByDriver(id, driverId);
  }
}
