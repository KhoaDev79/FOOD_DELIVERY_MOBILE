import { CartCheckService } from './cart-check.service';
import { CartController } from './cart.controller';
import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrderPricingService } from './order-pricing.service';
import { AdminRefundsController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [RealtimeModule, RestaurantsModule, NotificationsModule, MapsModule],
  controllers: [OrdersController, AdminRefundsController, CartController],
  providers: [OrdersService, OrderPricingService, CartCheckService],
  exports: [OrdersService, OrderPricingService],
})
export class OrdersModule {}
