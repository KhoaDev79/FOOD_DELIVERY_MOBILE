import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('banners')
export class BannersController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /banners – banner đang bật cho trang chủ, theo thứ tự hiển thị (chỉ đọc). */
  @Public()
  @Get()
  list() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, imageUrl: true, actionType: true, actionValue: true, sortOrder: true },
    });
  }
}
