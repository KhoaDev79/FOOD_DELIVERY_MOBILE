import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [RestaurantsController, ReviewsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
