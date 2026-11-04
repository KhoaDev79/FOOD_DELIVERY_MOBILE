import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';
import { SupportBotController } from './support-bot.controller';
import { SupportBotService } from './support-bot.service';
import {
  AdminSupportController,
  SupportTicketController,
} from './support-ticket.controller';
import { SupportTicketService } from './support-ticket.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    HelpController,
    SupportTicketController,
    AdminSupportController,
    SupportBotController,
  ],
  providers: [HelpService, SupportTicketService, SupportBotService],
  exports: [HelpService, SupportTicketService, SupportBotService],
})
export class HelpModule {}

