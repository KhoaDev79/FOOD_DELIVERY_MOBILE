import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { BotFeedbackDto, BotHandoverDto, SendBotMessageDto } from './dto/support-ticket.dto';
import { SupportBotService } from './support-bot.service';

@Controller('help/bot')
export class SupportBotController {
  constructor(private readonly botService: SupportBotService) {}

  /** Lời chào, chế độ (AI/cơ bản) và số lượt còn lại hôm nay. */
  @Get('welcome')
  getWelcome(@CurrentUser() user: AuthUser) {
    return this.botService.getWelcome(user.id);
  }

  @Post('messages')
  sendMessage(@CurrentUser() user: AuthUser, @Body() dto: SendBotMessageDto) {
    return this.botService.sendMessage(user.id, dto);
  }

  @Get('conversations')
  getConversationMessages(
    @CurrentUser() user: AuthUser,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.botService.getConversationMessages(user.id, conversationId);
  }

  /** Khách xác nhận chuyển cho nhân viên: tạo phiếu hỗ trợ kèm tóm tắt hội thoại. */
  @Post('handover')
  handover(@CurrentUser() user: AuthUser, @Body() dto: BotHandoverDto) {
    return this.botService.handover(user.id, dto);
  }

  @Post('messages/:id/feedback')
  @HttpCode(HttpStatus.OK)
  submitFeedback(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: BotFeedbackDto,
  ) {
    return this.botService.submitFeedback(user.id, messageId, dto);
  }
}
