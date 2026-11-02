import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { liveBannerWhere, normalizeBannerAction } from '../content/content-rules';
import { PrismaService } from '../prisma/prisma.service';

@Controller('banners')
export class BannersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /banners – banner cho trang chủ: đang bật VÀ đang trong lịch chạy, theo thứ tự hiển thị.
   * actionType luôn là NONE | RESTAURANT | CUISINE | SEARCH (giá trị cũ khác coi như NONE).
   */
  @Public()
  @Get()
  async list() {
    const rows = await this.prisma.banner.findMany({
      where: liveBannerWhere(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, imageUrl: true, actionType: true, actionValue: true, sortOrder: true },
    });
    return rows.map((b) => ({ ...b, ...normalizeBannerAction(b.actionType, b.actionValue) }));
  }
}
