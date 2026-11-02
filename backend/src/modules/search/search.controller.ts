import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export class LogSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  query!: string;
}

export const DEFAULT_POPULAR_SEARCHES = [
  'Cơm tấm',
  'Phở',
  'Bún bò',
  'Gà rán',
  'Trà sữa',
  'Bánh mì',
  'Cà phê',
  'Pizza',
];

@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /search/popular – top từ khóa được tìm kiếm nhiều nhất */
  @Public()
  @Get('popular')
  async getPopular(): Promise<string[]> {
    try {
      // Lấy các tìm kiếm trong 30 ngày gần nhất
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = await this.prisma.searchLog.groupBy({
        by: ['query'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: {
          query: true,
        },
        orderBy: {
          _count: {
            query: 'desc',
          },
        },
        take: 8,
      });

      if (logs.length > 0) {
        return logs.map((l) => l.query);
      }
    } catch {
      // Fallback nếu chưa có dữ liệu hoặc bảng chưa tạo
    }

    return DEFAULT_POPULAR_SEARCHES;
  }

  /** POST /search/log – ghi nhận từ khóa người dùng tìm kiếm */
  @Public()
  @Post('log')
  async logSearch(@Body() body: LogSearchDto) {
    const trimmed = body.query?.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: false };
    }

    try {
      await this.prisma.searchLog.create({
        data: {
          query: trimmed,
        },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}

