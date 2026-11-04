import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminService } from './admin.service';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminStatsService],
  exports: [AdminService],
})
export class AdminModule {}
