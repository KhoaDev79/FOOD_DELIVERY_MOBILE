import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrderPricingService } from './order-pricing.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [RealtimeModule, RestaurantsModule, NotificationsModule, MapsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderPricingService],
  exports: [OrdersService, OrderPricingService],
})
export class OrdersModule {}
