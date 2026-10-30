import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrderJobsService } from './order-jobs.service';

@Module({
  imports: [OrdersModule, RealtimeModule, NotificationsModule],
  providers: [OrderJobsService],
  exports: [OrderJobsService],
})
export class JobsModule {}

