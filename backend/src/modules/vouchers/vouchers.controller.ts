import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role, VoucherFunding } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  AvailableVouchersQueryDto,
  CreateVoucherDto,
  ListVouchersQueryDto,
  UpdateVoucherDto,
  WalletQueryDto,
} from './dto/vouchers.dto';
import { VouchersService } from './vouchers.service';

/** API voucher cho khách hàng */
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  /** Mã nổi bật trên trang chủ (không cần đăng nhập) */
  @Public()
  @Get('featured')
  featured() {
    return this.vouchers.featured();
  }

  /** Mã dùng được cho giỏ hàng ở màn Thanh toán */
  @Get('available')
  available(@CurrentUser() user: AuthUser, @Query() q: AvailableVouchersQueryDto) {
    return this.vouchers.listAvailable(user.id, q.restaurantId, q.subtotal, q.deliveryFee ?? 0);
  }

  /** Ví voucher của tôi */
  @Get('wallet')
  wallet(@CurrentUser() user: AuthUser, @Query() q: WalletQueryDto) {
    return this.vouchers.wallet(user.id, q.tab ?? 'available');
  }
}

/** Admin quản lý voucher toàn sàn (sàn chịu chi phí) */
@Roles(Role.ADMIN)
@Controller('admin/vouchers')
export class AdminVouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  list(@Query() q: ListVouchersQueryDto) {
    return this.vouchers.list({}, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto, user.id, { fundedBy: VoucherFunding.PLATFORM });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateVoucherDto) {
    return this.vouchers.update(id, dto, user.id, {});
  }
}

/** Chủ quán quản lý voucher của quán mình (quán chịu chi phí, trừ vào doanh thu) */
@Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
@Controller('restaurants/:restaurantId/vouchers')
export class RestaurantVouchersController {
  constructor(
    private readonly vouchers: VouchersService,
    private readonly restaurants: RestaurantsService,
  ) {}

  @Get()
  async list(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: AuthUser,
    @Query() q: ListVouchersQueryDto,
  ) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.vouchers.list({ restaurantId }, q);
  }

  @Post()
  async create(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVoucherDto,
  ) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.vouchers.create(dto, user.id, { restaurantId, fundedBy: VoucherFunding.RESTAURANT });
  }

  @Patch(':id')
  async update(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateVoucherDto,
  ) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.vouchers.update(id, dto, user.id, { restaurantId });
  }
}
