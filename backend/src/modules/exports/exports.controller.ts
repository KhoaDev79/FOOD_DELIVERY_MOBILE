import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CsvFile, ExportsService } from './exports.service';

export class ExportRangeQueryDto {
  /** Ngày bắt đầu theo giờ VN, YYYY-MM-DD (mặc định 30 ngày trước). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  /** Ngày kết thúc (gồm cả ngày này), YYYY-MM-DD (mặc định hôm nay). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;
}

/** Xuất CSV. Trả file thô (không bọc { success, data }) để tải về / mở bằng Excel. */
@Controller()
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  private send(res: Response, file: CsvFile) {
    res
      .status(200)
      .type('text/csv; charset=utf-8')
      .set({
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'X-Row-Count': String(file.rowCount),
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Row-Count',
        'Cache-Control': 'no-store',
      })
      .send(file.content);
  }

  /** GET /admin/export/orders?from=2026-10-01&to=2026-10-31 */
  @Roles(Role.ADMIN)
  @Get('admin/export/orders')
  async adminOrders(@CurrentUser('id') adminId: string, @Query() q: ExportRangeQueryDto, @Res() res: Response) {
    this.send(res, await this.exports.adminOrders(adminId, q.from, q.to));
  }

  /** GET /restaurants/:id/export/revenue?from=…&to=… (chủ quán của quán đó hoặc admin) */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get('restaurants/:id/export/revenue')
  async restaurantRevenue(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() q: ExportRangeQueryDto,
    @Res() res: Response,
  ) {
    this.send(res, await this.exports.restaurantRevenue(id, user, q.from, q.to));
  }
}
