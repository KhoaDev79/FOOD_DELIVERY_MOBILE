import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { csvFileName, toCsv, vnDateRange } from '../../common/utils/csv.util';
import {
  ADMIN_ORDER_HEADERS,
  adminOrderRows,
  ExportOrder,
  RESTAURANT_REVENUE_HEADERS,
  restaurantRevenueRows,
} from '../../common/utils/order-export.util';
import { PrismaService } from '../prisma/prisma.service';

/** Giới hạn số đơn mỗi file: tránh làm treo máy chủ miễn phí; vượt thì yêu cầu thu hẹp khoảng ngày. */
const MAX_ROWS = 50_000;

const EXPORT_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  subtotal: true,
  deliveryFee: true,
  peakSurcharge: true,
  discountAmount: true,
  shippingDiscount: true,
  restaurantDiscount: true,
  voucherCode: true,
  freeshipVoucherCode: true,
  total: true,
  platformCommission: true,
  driverEarning: true,
  distanceKm: true,
  cancelReason: true,
  failedReason: true,
  cancelNote: true,
  restaurant: { select: { name: true } },
  customer: { select: { fullName: true, phone: true } },
  driver: { select: { fullName: true } },
  items: { select: { name: true, quantity: true } },
} satisfies Prisma.OrderSelect;

export interface CsvFile {
  fileName: string;
  content: string;
  rowCount: number;
}

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    try {
      return vnDateRange(from, to);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  private async loadOrders(where: Prisma.OrderWhereInput): Promise<ExportOrder[]> {
    const count = await this.prisma.order.count({ where });
    if (count > MAX_ROWS) {
      throw new BadRequestException(`Kỳ này có ${count} đơn, vượt giới hạn ${MAX_ROWS}. Hãy chọn khoảng ngày ngắn hơn.`);
    }
    return this.prisma.order.findMany({ where, select: EXPORT_SELECT, orderBy: { createdAt: 'asc' } });
  }

  /** Admin: toàn bộ đơn trong kỳ (mọi trạng thái), có SĐT khách để đối soát. */
  async adminOrders(actorId: string, from?: string, to?: string): Promise<CsvFile> {
    const r = this.range(from, to);
    const orders = await this.loadOrders({ createdAt: { gte: r.start, lt: r.end } });
    // File có dữ liệu cá nhân của khách → ghi nhật ký ai đã xuất
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'EXPORT_ORDERS_CSV',
        targetType: 'ORDER',
        targetId: 'ALL',
        metadata: { from: r.from, to: r.to, rows: orders.length },
      },
    });
    return {
      fileName: csvFileName('zomzom-don-hang', r.from, r.to),
      content: toCsv(ADMIN_ORDER_HEADERS, adminOrderRows(orders)),
      rowCount: orders.length,
    };
  }

  /** Chủ quán (hoặc admin): doanh thu của một quán theo kỳ, tên khách đã che bớt. */
  async restaurantRevenue(restaurantId: string, user: AuthUser, from?: string, to?: string): Promise<CsvFile> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true, name: true },
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
    if (user.role !== 'ADMIN' && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không phải chủ nhà hàng này');
    }
    const r = this.range(from, to);
    const orders = await this.loadOrders({ restaurantId, createdAt: { gte: r.start, lt: r.end } });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'EXPORT_REVENUE_CSV',
        targetType: 'RESTAURANT',
        targetId: restaurantId,
        metadata: { restaurantName: restaurant.name, from: r.from, to: r.to, rows: orders.length },
      },
    });
    return {
      fileName: csvFileName('zomzom-doanh-thu', r.from, r.to),
      content: toCsv(RESTAURANT_REVENUE_HEADERS, restaurantRevenueRows(orders)),
      rowCount: orders.length,
    };
  }
}
