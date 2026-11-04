import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Voucher, VoucherFunding, VoucherKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto, ListVouchersQueryDto, UpdateVoucherDto } from './dto/vouchers.dto';
import {
  applyVoucherSelection,
  AppliedVoucher,
  evaluateVoucher,
  normalizeVoucherCode,
  VoucherSelectionResult,
} from './voucher-rules';

type Db = Prisma.TransactionClient | PrismaService;

/** Voucher trả cho app khách: thông tin hiển thị + kết quả xét điều kiện với giỏ hiện tại. */
export interface VoucherView {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: Voucher['discountType'];
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  endDate: Date;
  restaurant: { id: string; name: string } | null;
  isPersonal: boolean;
  onlyNewCustomer: boolean;
  /** Số lượt còn lại của mã (toàn hệ thống) */
  remaining: number;
  eligible?: boolean;
  reason?: string;
  estimatedSaving?: number;
}

const RESTAURANT_SELECT = { select: { id: true, name: true } } as const;

/** Mã cho voucher bồi thường: BT + 6 ký tự, dễ đọc, không dùng ký tự dễ nhầm (0/O, 1/I). */
export function generateCompensationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return `BT${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Tính giá (dùng trong báo giá đơn)
  // -------------------------------------------------------------------------

  /** Áp các mã khách chọn vào giỏ hàng. Không ném lỗi với mã sai: trả về danh sách bị từ chối kèm lý do. */
  async priceSelection(
    db: Db,
    params: { userId: string; restaurantId: string; subtotal: number; deliveryFee: number; codes: string[]; now: Date },
  ): Promise<VoucherSelectionResult> {
    const codes = [...new Set(params.codes.map(normalizeVoucherCode).filter(Boolean))].slice(0, 2);
    if (codes.length === 0) {
      return { applied: [], rejected: [], discount: 0, shippingDiscount: 0, restaurantDiscount: 0 };
    }
    const vouchers = await db.voucher.findMany({ where: { code: { in: codes } } });
    const [usageCounts, deliveredOrdersCount] = await Promise.all([
      this.userUsageCounts(db, params.userId, vouchers.map((v) => v.id)),
      this.deliveredCount(db, params.userId),
    ]);
    return applyVoucherSelection(codes, new Map(vouchers.map((v) => [v.code, v])), (v) => ({
      now: params.now,
      userId: params.userId,
      restaurantId: params.restaurantId,
      subtotal: params.subtotal,
      deliveryFee: params.deliveryFee,
      userUsageCount: usageCounts.get(v.id) ?? 0,
      deliveredOrdersCount,
    }));
  }

  /**
   * Giữ lượt dùng khi tạo đơn (trong transaction đặt đơn).
   * Khoá dòng voucher (FOR UPDATE) rồi kiểm tra lại lượt, để nhiều khách đặt cùng lúc không vượt giới hạn.
   */
  async redeem(tx: Prisma.TransactionClient, applied: AppliedVoucher[], userId: string, orderId: string, now = new Date()) {
    for (const a of applied) {
      await tx.$queryRaw`SELECT "id" FROM "vouchers" WHERE "id" = ${a.voucher.id}::uuid FOR UPDATE`;
      const fresh = await tx.voucher.findUnique({ where: { id: a.voucher.id } });
      const userUsage = await tx.voucherUsage.count({
        where: { voucherId: a.voucher.id, userId, releasedAt: null },
      });
      const ev = fresh
        ? evaluateVoucher(fresh, {
            now,
            userId,
            restaurantId: a.voucher.restaurantId ?? '',
            subtotal: Number.MAX_SAFE_INTEGER, // tiền món đã được xét ở báo giá; ở đây chỉ kiểm tra lại lượt/hạn
            deliveryFee: 1,
            userUsageCount: userUsage,
            deliveredOrdersCount: fresh.onlyNewCustomer ? await this.deliveredCount(tx, userId) : 0,
          })
        : null;
      // restaurantId ở trên lấy theo chính voucher nên bỏ qua kiểm tra phạm vi quán (đã xét ở báo giá)
      if (!ev?.eligible) {
        throw new ConflictException({
          code: 'VOUCHER_UNAVAILABLE',
          message: `Mã ${a.voucher.code}: ${ev?.reason ?? 'không còn áp dụng'}. Vui lòng chọn lại mã giảm giá.`,
        });
      }
      await tx.voucher.update({ where: { id: a.voucher.id }, data: { usedCount: { increment: 1 } } });
      await tx.voucherUsage.create({
        data: {
          voucherId: a.voucher.id,
          userId,
          orderId,
          discountAmount: a.discount + a.shippingDiscount,
        },
      });
    }
  }

  /** Hoàn lượt khi đơn bị huỷ hoặc giao thất bại. Gọi nhiều lần cũng an toàn (chỉ hoàn lượt chưa hoàn). */
  async releaseForOrder(tx: Prisma.TransactionClient, orderId: string, now = new Date()): Promise<number> {
    const usages = await tx.voucherUsage.findMany({ where: { orderId, releasedAt: null } });
    for (const u of usages) {
      const { count } = await tx.voucherUsage.updateMany({
        where: { id: u.id, releasedAt: null },
        data: { releasedAt: now },
      });
      if (count === 1) {
        await tx.voucher.updateMany({
          where: { id: u.voucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }
    return usages.length;
  }

  // -------------------------------------------------------------------------
  // App khách
  // -------------------------------------------------------------------------

  /** Mã dùng được cho giỏ hàng hiện tại: mã đủ điều kiện xếp trước (giảm nhiều nhất trước), mã chưa đủ kèm lý do. */
  async listAvailable(userId: string, restaurantId: string, subtotal: number, deliveryFee: number, now = new Date()) {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        endDate: { gt: now },
        AND: [
          { OR: [{ restaurantId: null }, { restaurantId }] },
          { OR: [{ userId: null }, { userId }] },
        ],
      },
      include: { restaurant: RESTAURANT_SELECT },
      orderBy: { endDate: 'asc' },
      take: 100,
    });
    const [usageCounts, delivered] = await Promise.all([
      this.userUsageCounts(this.prisma, userId, vouchers.map((v) => v.id)),
      this.deliveredCount(this.prisma, userId),
    ]);

    const views = vouchers
      .map((v) => {
        const ev = evaluateVoucher(v, {
          now,
          userId,
          restaurantId,
          subtotal,
          deliveryFee,
          userUsageCount: usageCounts.get(v.id) ?? 0,
          deliveredOrdersCount: delivered,
        });
        // Mã đã dùng hết lượt của khách / hết lượt toàn hệ thống / khách cũ: ẩn luôn, giữ lại mã chỉ thiếu tiền
        const hidden = !ev.eligible && /đã dùng|hết lượt|đơn đầu tiên|chưa tới|áp dụng từ/i.test(ev.reason ?? '');
        if (hidden) return null;
        return {
          ...this.toView(v),
          eligible: ev.eligible,
          reason: ev.reason,
          estimatedSaving: ev.discount + ev.shippingDiscount,
          slot: ev.slot,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return views.sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        (b.estimatedSaving ?? 0) - (a.estimatedSaving ?? 0) ||
        a.endDate.getTime() - b.endDate.getTime(),
    );
  }

  /** Ví voucher: mã còn dùng được (toàn sàn, của quán, cá nhân) hoặc lịch sử mã đã dùng/hết hạn. */
  async wallet(userId: string, tab: 'available' | 'history' = 'available', now = new Date()) {
    if (tab === 'history') {
      const usages = await this.prisma.voucherUsage.findMany({
        where: { userId, releasedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { voucher: { include: { restaurant: RESTAURANT_SELECT } } },
      });
      const expiredPersonal = await this.prisma.voucher.findMany({
        where: { userId, endDate: { lte: now }, usedCount: 0 },
        include: { restaurant: RESTAURANT_SELECT },
        take: 20,
      });
      return [
        ...usages.map((u) => ({
          ...this.toView(u.voucher),
          status: 'USED' as const,
          usedAt: u.createdAt,
          savedAmount: u.discountAmount,
          orderId: u.orderId,
        })),
        ...expiredPersonal.map((v) => ({ ...this.toView(v), status: 'EXPIRED' as const })),
      ];
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        endDate: { gt: now },
        startDate: { lte: now },
        OR: [{ userId: null }, { userId }],
      },
      include: { restaurant: RESTAURANT_SELECT },
      orderBy: [{ userId: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
      take: 100,
    });
    const [usageCounts, delivered] = await Promise.all([
      this.userUsageCounts(this.prisma, userId, vouchers.map((v) => v.id)),
      this.deliveredCount(this.prisma, userId),
    ]);
    return vouchers
      .filter(
        (v) =>
          v.usedCount < v.maxUsage &&
          (usageCounts.get(v.id) ?? 0) < v.perUserLimit &&
          !(v.onlyNewCustomer && delivered > 0),
      )
      .map((v) => ({ ...this.toView(v), status: 'AVAILABLE' as const }));
  }

  /** Mã nổi bật cho trang chủ: mã toàn sàn, còn hạn, còn lượt (không cần đăng nhập). */
  async featured(now = new Date()) {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        kind: VoucherKind.CAMPAIGN,
        userId: null,
        restaurantId: null,
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'asc' },
      take: 20,
    });
    return vouchers
      .filter((v) => v.usedCount < v.maxUsage)
      .slice(0, 6)
      .map((v) => this.toView({ ...v, restaurant: null }));
  }

  // -------------------------------------------------------------------------
  // Quản lý (admin toàn sàn, chủ quán cho quán của mình)
  // -------------------------------------------------------------------------

  async list(scope: { restaurantId?: string }, q: ListVouchersQueryDto, now = new Date()) {
    const where: Prisma.VoucherWhereInput = {
      ...(scope.restaurantId ? { restaurantId: scope.restaurantId, fundedBy: VoucherFunding.RESTAURANT } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status === 'active' ? { isActive: true, endDate: { gt: now } } : {}),
      ...(q.status === 'inactive' ? { isActive: false } : {}),
      ...(q.status === 'expired' ? { endDate: { lte: now } } : {}),
      ...(q.q ? { OR: [{ code: { contains: q.q.toUpperCase() } }, { title: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const items = await this.prisma.voucher.findMany({
      where,
      include: { restaurant: RESTAURANT_SELECT, user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return items;
  }

  async create(
    dto: CreateVoucherDto,
    actorId: string,
    scope: { restaurantId?: string; fundedBy: VoucherFunding },
  ) {
    const data = this.validateShape({ ...dto, restaurantId: scope.restaurantId ?? dto.restaurantId ?? null });
    const exists = await this.prisma.voucher.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Mã ${dto.code} đã tồn tại, vui lòng chọn mã khác`);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.voucher.create({
        data: {
          code: dto.code,
          title: dto.title,
          description: dto.description || null,
          discountType: dto.discountType,
          discountValue: data.discountValue,
          maxDiscountAmount: data.maxDiscountAmount,
          minOrderAmount: dto.minOrderAmount ?? 0,
          maxUsage: dto.maxUsage,
          perUserLimit: dto.perUserLimit ?? 1,
          startDate: data.startDate,
          endDate: data.endDate,
          onlyNewCustomer: dto.onlyNewCustomer ?? false,
          isActive: dto.isActive ?? true,
          restaurantId: data.restaurantId,
          fundedBy: scope.fundedBy,
          kind: VoucherKind.CAMPAIGN,
          createdById: actorId,
        },
        include: { restaurant: RESTAURANT_SELECT },
      });
      await this.audit(tx, actorId, 'VOUCHER_CREATE', created.id, { code: created.code, fundedBy: scope.fundedBy });
      return created;
    });
  }

  async update(id: string, dto: UpdateVoucherDto, actorId: string, scope: { restaurantId?: string }) {
    const current = await this.prisma.voucher.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy voucher');
    if (scope.restaurantId && (current.restaurantId !== scope.restaurantId || current.fundedBy !== 'RESTAURANT')) {
      throw new ForbiddenException('Bạn chỉ sửa được voucher của quán mình');
    }
    if (current.kind === VoucherKind.COMPENSATION && dto.discountValue !== undefined) {
      throw new BadRequestException('Không đổi giá trị voucher bồi thường đã phát; hãy tắt và phát mã mới');
    }
    // Mã đã có người dùng: không đổi mức giảm/điều kiện để đơn cũ và đơn mới cùng một chính sách
    if (current.usedCount > 0 && (dto.discountValue !== undefined || dto.maxDiscountAmount !== undefined || dto.minOrderAmount !== undefined)) {
      throw new BadRequestException('Mã đã được sử dụng nên không đổi mức giảm hoặc đơn tối thiểu. Hãy tạo mã mới.');
    }
    if (dto.maxUsage !== undefined && dto.maxUsage < current.usedCount) {
      throw new BadRequestException(`Tổng lượt không được nhỏ hơn số lượt đã dùng (${current.usedCount})`);
    }

    const merged = this.validateShape({
      discountType: current.discountType,
      discountValue: dto.discountValue ?? current.discountValue,
      maxDiscountAmount: dto.maxDiscountAmount !== undefined ? dto.maxDiscountAmount : current.maxDiscountAmount,
      startDate: dto.startDate ?? current.startDate.toISOString(),
      endDate: dto.endDate ?? current.endDate.toISOString(),
      restaurantId: current.restaurantId,
      allowPastEnd: true,
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.voucher.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          discountValue: dto.discountValue !== undefined ? merged.discountValue : undefined,
          maxDiscountAmount: dto.maxDiscountAmount !== undefined ? merged.maxDiscountAmount : undefined,
          minOrderAmount: dto.minOrderAmount,
          maxUsage: dto.maxUsage,
          perUserLimit: dto.perUserLimit,
          startDate: dto.startDate ? merged.startDate : undefined,
          endDate: dto.endDate ? merged.endDate : undefined,
          onlyNewCustomer: dto.onlyNewCustomer,
          isActive: dto.isActive,
        },
        include: { restaurant: RESTAURANT_SELECT },
      });
      await this.audit(tx, actorId, 'VOUCHER_UPDATE', id, { code: current.code, changes: { ...dto } });
      return updated;
    });
  }

  /** Voucher cá nhân bồi thường khiếu nại: 1 lần dùng, không yêu cầu đơn tối thiểu, hạn 30 ngày, sàn chịu. */
  async createCompensation(
    db: Db,
    params: { userId: string; amount: number; actorId: string | null; ticketCode: string; validDays?: number },
    now = new Date(),
  ) {
    let code = generateCompensationCode();
    for (let i = 0; i < 5 && (await db.voucher.findUnique({ where: { code } })); i++) code = generateCompensationCode();
    const voucher = await db.voucher.create({
      data: {
        code,
        title: `Voucher bồi thường ${params.amount.toLocaleString('vi-VN')} ₫`,
        description: `Bồi thường cho yêu cầu hỗ trợ ${params.ticketCode}`,
        discountType: 'FIXED_AMOUNT',
        discountValue: params.amount,
        minOrderAmount: 0,
        maxUsage: 1,
        perUserLimit: 1,
        startDate: now,
        endDate: new Date(now.getTime() + (params.validDays ?? 30) * 24 * 60 * 60 * 1000),
        userId: params.userId,
        fundedBy: VoucherFunding.PLATFORM,
        kind: VoucherKind.COMPENSATION,
        createdById: params.actorId,
      },
    });
    if (params.actorId) {
      await this.audit(db, params.actorId, 'VOUCHER_COMPENSATION', voucher.id, {
        code,
        amount: params.amount,
        userId: params.userId,
        ticketCode: params.ticketCode,
      });
    }
    return voucher;
  }

  // -------------------------------------------------------------------------

  private validateShape(input: {
    discountType: Voucher['discountType'];
    discountValue: number;
    maxDiscountAmount?: number | null;
    startDate?: string;
    endDate: string;
    restaurantId: string | null;
    allowPastEnd?: boolean;
  }) {
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = new Date(input.endDate);
    if (endDate <= startDate) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    if (!input.allowPastEnd && endDate <= new Date()) throw new BadRequestException('Ngày kết thúc phải ở tương lai');

    let maxDiscountAmount = input.maxDiscountAmount ?? null;
    if (input.discountType === 'PERCENTAGE') {
      if (input.discountValue < 1 || input.discountValue > 100) {
        throw new BadRequestException('Giảm theo % phải từ 1 đến 100');
      }
      if (!maxDiscountAmount) throw new BadRequestException('Mã giảm theo % bắt buộc có mức giảm tối đa');
    } else {
      maxDiscountAmount = null;
      if (input.discountType === 'FIXED_AMOUNT' && input.discountValue < 1000) {
        throw new BadRequestException('Số tiền giảm tối thiểu 1.000 ₫');
      }
    }
    return { discountValue: input.discountValue, maxDiscountAmount, startDate, endDate, restaurantId: input.restaurantId };
  }

  private toView(v: Voucher & { restaurant?: { id: string; name: string } | null }): VoucherView {
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      description: v.description,
      discountType: v.discountType,
      discountValue: v.discountValue,
      maxDiscountAmount: v.maxDiscountAmount,
      minOrderAmount: v.minOrderAmount,
      endDate: v.endDate,
      restaurant: v.restaurant ?? null,
      isPersonal: Boolean(v.userId),
      onlyNewCustomer: v.onlyNewCustomer,
      remaining: Math.max(0, v.maxUsage - v.usedCount),
    };
  }

  private async userUsageCounts(db: Db, userId: string, voucherIds: string[]) {
    if (voucherIds.length === 0) return new Map<string, number>();
    const rows = await db.voucherUsage.groupBy({
      by: ['voucherId'],
      where: { userId, voucherId: { in: voucherIds }, releasedAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.voucherId, r._count._all]));
  }

  private deliveredCount(db: Db, userId: string) {
    return db.order.count({ where: { customerId: userId, status: OrderStatus.DELIVERED } });
  }

  private audit(db: Db, actorId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
    return db.auditLog.create({
      data: { actorId, action, targetType: 'VOUCHER', targetId, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}
