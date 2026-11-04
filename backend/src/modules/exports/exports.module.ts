import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

/** Xuất CSV: đơn hàng (admin), doanh thu quán (chủ quán). */
@Module({ controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
