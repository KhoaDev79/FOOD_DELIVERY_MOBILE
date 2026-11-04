import { Global, Module } from '@nestjs/common';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { AdminVouchersController, RestaurantVouchersController, VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

/** Toàn cục để Orders (báo giá, đặt đơn, huỷ) và Help (bồi thường) dùng chung một VouchersService. */
@Global()
@Module({
  imports: [RestaurantsModule],
  controllers: [VouchersController, AdminVouchersController, RestaurantVouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
