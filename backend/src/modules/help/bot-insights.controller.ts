import { Controller, DefaultValuePipe, Get, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { BotInsightsService } from './bot-insights.service';

/** Admin: chất lượng Trợ lý tự động (thống kê, câu hỏi chưa trả lời được, xem lại hội thoại). */
@Roles(Role.ADMIN)
@Controller('admin/help/bot')
export class BotInsightsController {
  constructor(private readonly insights: BotInsightsService) {}

  @Get('stats')
  stats(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.insights.stats(Math.min(Math.max(days, 1), 90));
  }

  @Get('conversations')
  conversations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('onlyProblems', new DefaultValuePipe(false), ParseBoolPipe) onlyProblems: boolean,
  ) {
    return this.insights.listConversations(Math.max(page, 1), Math.min(Math.max(limit, 1), 50), onlyProblems);
  }

  @Get('conversations/:id')
  conversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.insights.conversationMessages(id);
  }
}
