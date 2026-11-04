import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DriverVerificationStatus, OrderStatus, Prisma, RestaurantStatus, Role, RoleRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildKpis,
  buildSeries,
  countEndReasons,
  resolveStatsWindow,
  StatsOrderRow,
  StatsRange,
  summarizePeriod,
  topRestaurantsByGmv,
} from './admin-stats.util';
import { ListAuditLogsQueryDto } from './dto/admin.dto';

const RUNNING: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.PICKED_UP,
];

const ROW_SELECT = {
  createdAt: true,
  status: true,
  restaurantId: true,
  subtotal: true,
  deliveryFee: true,
  platformCommission: true,
  cancelReason: true,
  failedReason: true,
} as const;

/** Tỉ lệ công nợ COD coi là "gần chạm hạn mức" để cảnh báo sớm. */
const DEBT_WARNING_RATIO = 0.8;

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private get debtLimit(): number {
    return Number(this.config?.get<number>('business.driverDebtLimit') ?? 2_000_000);
  }

  /** Bảng điều khiển: KPI có so sánh kỳ trước, biểu đồ, phễu đơn đang chạy, top quán, lý do huỷ, việc cần xử lý. */
  async getOverview(range: StatsRange, now = new Date()) {
    const win = resolveStatsWindow(range, now);

    const [rows, funnelRaw, attention] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: win.prevStart, lt: win.end } },
        select: ROW_SELECT,
      }),
      this.prisma.order.groupBy({ by: ['status'], where: { status: { in: RUNNING } }, _count: { id: true } }),
      this.getAttention(now),
    ]);

    // Kỳ trước kết thúc tại prevEnd (cùng thời điểm trong ngày) để so sánh công bằng khi kỳ này chưa hết
    const current = rows.filter((r) => r.createdAt >= win.start) as StatsOrderRow[];
    const previous = rows.filter((r) => r.createdAt < win.prevEnd) as StatsOrderRow[];

    const top = topRestaurantsByGmv(current, 5);
    const restaurants = top.length
      ? await this.prisma.restaurant.findMany({
          where: { id: { in: top.map((t) => t.restaurantId) } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
    const byId = new Map(restaurants.map((r) => [r.id, r]));

    const funnel = Object.fromEntries(RUNNING.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const f of funnelRaw) funnel[f.status] = f._count.id;

    return {
      range,
      generatedAt: now.toISOString(),
      period: {
        start: win.start.toISOString(),
        end: win.end.toISOString(),
        prevStart: win.prevStart.toISOString(),
        prevEnd: win.prevEnd.toISOString(),
        bucket: win.bucket,
      },
      kpis: buildKpis(summarizePeriod(current), summarizePeriod(previous)),
      series: buildSeries(current, win),
      funnel: { statuses: funnel, stalled: attention.stalled.count },
      topRestaurants: top.map((t) => ({
        id: t.restaurantId,
        name: byId.get(t.restaurantId)?.name ?? 'Quán đã xoá',
        imageUrl: byId.get(t.restaurantId)?.imageUrl ?? null,
        gmv: t.gmv,
        orders: t.orders,
      })),
      cancelReasons: countEndReasons(current),
      attention,
    };
  }

  /** Những việc admin cần xử lý ngay; dùng chung cho Tổng quan và số việc chờ ở tab Hệ thống. */
  async getAttention(now = new Date()) {
    const limit = this.debtLimit;
    const [stalledOrders, roleRequests, pendingRestaurants, unassignedRestaurants, pendingVehicles, overDebt, nearDebt] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { stalledAt: { not: null }, status: { in: RUNNING } },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            statusHistory: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
          take: 100,
        }),
        this.prisma.roleUpgradeRequest.count({ where: { status: RoleRequestStatus.PENDING } }),
        this.prisma.restaurant.count({ where: { status: RestaurantStatus.PENDING_APPROVAL } }),
        this.prisma.restaurant.count({
          where: { OR: [{ owner: { role: { not: Role.RESTAURANT_OWNER } } }, { owner: { isActive: false } }] },
        }),
        this.prisma.driverProfile.count({
          where: { verificationStatus: DriverVerificationStatus.PENDING, user: { role: Role.DRIVER } },
        }),
        this.prisma.driverProfile.count({ where: { codBalance: { gte: limit }, user: { role: Role.DRIVER } } }),
        this.prisma.driverProfile.count({
          where: {
            codBalance: { gte: Math.round(limit * DEBT_WARNING_RATIO), lt: limit },
            user: { role: Role.DRIVER },
          },
        }),
      ]);

    // Đơn kẹt lâu nhất: tính từ lúc đơn bước vào trạng thái hiện tại
    let oldestSince: Date | null = null;
    for (const o of stalledOrders) {
      const since = o.statusHistory[0]?.createdAt ?? o.updatedAt;
      if (!oldestSince || since < oldestSince) oldestSince = since;
    }

    return {
      stalled: {
        count: stalledOrders.length,
        oldestSince: oldestSince?.toISOString() ?? null,
        oldestMinutes: oldestSince ? Math.max(0, Math.floor((now.getTime() - oldestSince.getTime()) / 60000)) : 0,
      },
      roleRequests: roleRequests,
      restaurantsPending: pendingRestaurants,
      restaurantsUnassigned: unassignedRestaurants,
      vehiclesPending: pendingVehicles,
      driversOverDebt: overDebt,
      driversNearDebt: nearDebt,
      debtLimit: limit,
    };
  }

  /** Nhật ký quản trị: lọc theo người làm, loại hành động, khoảng ngày. */
  async listAuditLogs(q: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lt: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit, hasMore: q.page * q.limit < total };
  }

  /** GMV + số đơn 7 ngày gần nhất của một quán (theo ngày, giờ VN). */
  async restaurantLast7Days(restaurantId: string, now = new Date()) {
    const win = resolveStatsWindow('7d', now);
    const rows = (await this.prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: win.start, lt: win.end } },
      select: ROW_SELECT,
    })) as StatsOrderRow[];
    const totals = summarizePeriod(rows);
    return { gmv: totals.gmv, orders: totals.orders, delivered: totals.delivered, series: buildSeries(rows, win) };
  }
}
