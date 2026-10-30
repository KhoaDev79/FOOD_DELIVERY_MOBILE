import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  DriverVerificationStatus,
  OrderStatus,
  Prisma,
  RestaurantStatus,
  Role,
  RoleRequestStatus,
  VehicleType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { hashSecret } from '../../common/utils/password.util';
import { generateUniqueUsername } from '../../common/utils/username.util';
import { isValidVietnameseLicensePlate, normalizeLicensePlate } from '../../common/utils/vietnamese-plate.util';
import { AuthStateService } from '../auth/auth-state.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import {
  AdminCreateRestaurantDto,
  AdminUpdateRestaurantDto,
  ChangeUserRoleDto,
  ListAdminOrdersQueryDto,
  ListAdminRestaurantsQueryDto,
  ListRoleRequestsQueryDto,
  ListUsersQueryDto,
  RejectRestaurantDto,
  RestaurantFilter,
  ReviewRoleRequestDto,
  ToggleUserActiveDto,
  UpdateRestaurantStatusDto,
  UpdateReviewVisibilityDto,
} from './dto/admin.dto';

export type AuditTargetType = 'USER' | 'RESTAURANT' | 'ORDER' | 'DRIVER' | 'REVIEW' | 'MENU_ITEM';

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  RESTAURANT_OWNER: 'Chủ quán',
  DRIVER: 'Tài xế',
  ADMIN: 'Quản trị viên',
};

const UNASSIGNED_WHERE: Prisma.RestaurantWhereInput = {
  OR: [{ owner: { role: { not: Role.RESTAURANT_OWNER } } }, { owner: { isActive: false } }],
};

const OWNER_SELECT = { id: true, fullName: true, email: true, phone: true, role: true, isActive: true } as const;

const needsOwner = (owner: { role: Role; isActive: boolean }) =>
  owner.role !== Role.RESTAURANT_OWNER || !owner.isActive;

export function generateSecureTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  const bytes = randomBytes(16);

  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    special[bytes[3] % special.length],
  ];
  for (let i = 4; i < 12; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Trộn ngẫu nhiên bằng các byte còn lại
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[12 + (i % 4)] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly authState?: AuthStateService,
    @Optional() private readonly gateway?: OrdersGateway,
  ) {}

  /** Ghi nhật ký thao tác quản trị (trong cùng transaction với thao tác). */
  private audit(
    db: Prisma.TransactionClient,
    actorId: string,
    action: string,
    targetType: AuditTargetType,
    targetId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return db.auditLog.create({ data: { actorId, action, targetType, targetId, metadata } });
  }

  /** Lấy danh sách toàn bộ người dùng hệ thống */
  async listUsers(q: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.q?.trim()
        ? {
            OR: [
              { fullName: { contains: q.q.trim(), mode: 'insensitive' } },
              { email: { contains: q.q.trim(), mode: 'insensitive' } },
              { phone: { contains: q.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          failedDeliveryCount: true,
          createdAt: true,
          _count: { select: { restaurants: true } },
          driverProfile: {
            select: {
              id: true,
              vehicleType: true,
              vehicleBrand: true,
              vehicleModel: true,
              vehicleColor: true,
              licensePlate: true,
              verificationStatus: true,
              rejectionReason: true,
              isOnline: true,
              codBalance: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      hasMore: q.page * q.limit < total,
    };
  }

  /** Khóa hoặc Mở khóa tài khoản (kèm lý do, ghi nhật ký, thu hồi quyền tức thời) */
  async toggleUserActive(userId: string, actingAdminId: string, dto: ToggleUserActiveDto = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (userId === actingAdminId) throw new BadRequestException('Không thể tự khoá tài khoản của chính mình');
    if (user.role === Role.ADMIN && user.isActive) {
      throw new BadRequestException('Không thể khoá tài khoản quản trị viên khác');
    }
    const locking = user.isActive;
    const reason = dto.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: !user.isActive,
          ...(locking ? { refreshTokenHash: null } : {}),
        },
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
      });
      if (locking && user.role === Role.DRIVER) {
        await tx.driverProfile.updateMany({
          where: { userId },
          data: { isOnline: false },
        });
      }
      await this.audit(tx, actingAdminId, locking ? 'USER_LOCK' : 'USER_UNLOCK', 'USER', userId, { reason });
      return res;
    });

    this.authState?.invalidate(userId);
    if (locking) {
      this.gateway?.disconnectUser(userId);
    }

    return updated;
  }

  /** Đổi vai trò trực tiếp cho một tài khoản */
  async changeUserRole(userId: string, actingAdminId: string, dto: ChangeUserRoleDto) {
    if (userId === actingAdminId) throw new BadRequestException('Không thể tự đổi vai trò của chính mình');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { restaurants: true } } },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.role === dto.role) return this.publicUser(userId);
    if (user.role === Role.ADMIN) throw new BadRequestException('Không thể đổi vai trò của quản trị viên khác');
    if (user.role === Role.RESTAURANT_OWNER && user._count.restaurants > 0) {
      throw new ConflictException(
        `Tài khoản đang sở hữu ${user._count.restaurants} quán. Hãy gán các quán này cho chủ khác trước khi đổi vai trò.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: dto.role, refreshTokenHash: null },
      });
      if (dto.role === Role.DRIVER) {
        await tx.driverProfile.upsert({ where: { userId }, update: {}, create: { userId } });
      }
      await this.audit(tx, actingAdminId, 'USER_CHANGE_ROLE', 'USER', userId, { from: user.role, to: dto.role });
    });

    this.authState?.invalidate(userId);
    this.gateway?.disconnectUser(userId);

    void this.notifications.sendToUsers([userId], {
      title: 'Vai trò tài khoản đã thay đổi',
      body: `Tài khoản của bạn đã chuyển sang vai trò ${ROLE_LABEL[dto.role]}. Vui lòng đăng nhập lại.`,
      data: { type: 'role_changed', role: dto.role },
    });
    return this.publicUser(userId);
  }

  private publicUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
  }

  /** Lịch sử hoạt động của một người dùng: nhật ký quản trị, đơn gần đây, yêu cầu nâng cấp */
  async getUserActivity(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const [auditLogs, recentOrders, orderCount, deliveryCount, roleRequests, restaurants] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { OR: [{ targetType: 'USER', targetId: userId }, { actorId: userId }] },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.order.findMany({
        where: { OR: [{ customerId: userId }, { driverId: userId }] },
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          customerId: true,
          restaurant: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.order.count({ where: { customerId: userId } }),
      this.prisma.order.count({ where: { driverId: userId, status: OrderStatus.DELIVERED } }),
      this.prisma.roleUpgradeRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.restaurant.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true, isOpen: true, status: true },
      }),
    ]);

    return {
      user,
      summary: { orderCount, deliveryCount, restaurantCount: restaurants.length },
      restaurants,
      auditLogs,
      recentOrders: recentOrders.map(({ customerId, ...o }) => ({ ...o, asCustomer: customerId === userId })),
      roleRequests,
    };
  }

  /** Lấy danh sách toàn bộ nhà hàng trong hệ thống (tìm kiếm + lọc nhanh + lọc theo status) */
  async listRestaurants(q: ListAdminRestaurantsQueryDto) {
    const where: Prisma.RestaurantWhereInput = {
      ...(q.q?.trim() ? { name: { contains: q.q.trim(), mode: 'insensitive' } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.filter === RestaurantFilter.OPEN ? { isOpen: true, status: RestaurantStatus.ACTIVE } : {}),
      ...(q.filter === RestaurantFilter.CLOSED ? { isOpen: false } : {}),
      ...(q.filter === RestaurantFilter.PENDING ? { status: RestaurantStatus.PENDING_APPROVAL } : {}),
      ...(q.filter === RestaurantFilter.SUSPENDED ? { status: RestaurantStatus.SUSPENDED } : {}),
      ...(q.filter === RestaurantFilter.UNASSIGNED ? UNASSIGNED_WHERE : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: {
          owner: { select: OWNER_SELECT },
          _count: { select: { menuItems: true, orders: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      items: items.map((r) => ({ ...r, needsOwner: needsOwner(r.owner) })),
      total,
      page: q.page,
      limit: q.limit,
      hasMore: q.page * q.limit < total,
    };
  }

  /** Chi tiết quán cho admin: thông tin, chủ quán, doanh thu, phân bổ đơn, lịch sử bàn giao */
  async getRestaurantDetail(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        owner: { select: OWNER_SELECT },
        _count: { select: { menuItems: true, orders: true, reviews: true, categories: true } },
      },
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');

    const [revenue, byStatus, history] = await Promise.all([
      this.prisma.order.aggregate({
        where: { restaurantId: id, status: OrderStatus.DELIVERED },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], where: { restaurantId: id }, _count: { id: true } }),
      this.prisma.auditLog.findMany({
        where: { targetType: 'RESTAURANT', targetId: id },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      ...restaurant,
      needsOwner: needsOwner(restaurant.owner),
      stats: {
        revenue: revenue._sum.total ?? 0,
        deliveredOrders: revenue._count.id,
        statuses: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      },
      history,
    };
  }

  /** Gán (bàn giao) quán cho một người dùng. Khách hàng được tự động nâng lên Chủ quán. */
  async assignRestaurantOwner(restaurantId: string, ownerId: string, actingAdminId: string) {
    const [restaurant, newOwner] = await Promise.all([
      this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
        include: { owner: { select: { id: true, fullName: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: ownerId } }),
    ]);
    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
    if (!newOwner) throw new NotFoundException('Không tìm thấy người dùng được chọn');
    if (!newOwner.isActive) {
      throw new BadRequestException('Tài khoản này đang bị khoá, không thể gán làm chủ quán');
    }
    if (newOwner.role === Role.DRIVER || newOwner.role === Role.ADMIN) {
      throw new ConflictException(
        `Tài khoản đang có vai trò ${ROLE_LABEL[newOwner.role]}, không thể gán làm chủ quán. Hãy chọn tài khoản Khách hàng hoặc Chủ quán.`,
      );
    }
    if (restaurant.ownerId === ownerId) throw new BadRequestException('Người dùng này đã là chủ của quán');
    const promoted = newOwner.role === Role.CUSTOMER;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (promoted) {
        await tx.user.update({
          where: { id: ownerId },
          data: { role: Role.RESTAURANT_OWNER, refreshTokenHash: null },
        });
        await this.audit(tx, actingAdminId, 'USER_CHANGE_ROLE', 'USER', ownerId, {
          from: Role.CUSTOMER,
          to: Role.RESTAURANT_OWNER,
          via: 'ASSIGN_RESTAURANT',
          restaurantId,
          restaurantName: restaurant.name,
        });
      }
      const rest = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { ownerId },
        include: { owner: { select: OWNER_SELECT }, _count: { select: { menuItems: true, orders: true } } },
      });
      await this.audit(tx, actingAdminId, 'RESTAURANT_ASSIGN_OWNER', 'RESTAURANT', restaurantId, {
        restaurantName: restaurant.name,
        fromOwnerId: restaurant.owner.id,
        fromOwnerName: restaurant.owner.fullName,
        toOwnerId: ownerId,
        toOwnerName: newOwner.fullName,
        promoted,
      });
      return rest;
    });

    if (promoted) {
      this.authState?.invalidate(ownerId);
      this.gateway?.disconnectUser(ownerId);
    }

    void this.notifications.sendToUsers([ownerId], {
      title: 'Bạn đã được giao quản lý quán',
      body: promoted
        ? `Quán "${restaurant.name}" đã được giao cho bạn. Vui lòng đăng nhập lại để vào trang chủ quán.`
        : `Quán "${restaurant.name}" đã được giao cho bạn quản lý.`,
      data: { type: 'restaurant_assigned', restaurantId },
    });

    return { ...updated, needsOwner: false, promoted };
  }

  /** Duyệt quán chờ duyệt -> ACTIVE */
  async approveRestaurant(restaurantId: string, actingAdminId: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          status: RestaurantStatus.ACTIVE,
          approvedAt: new Date(),
          approvedById: actingAdminId,
          suspendReason: null,
        },
        include: { owner: { select: OWNER_SELECT }, _count: { select: { menuItems: true, orders: true } } },
      });
      await this.audit(tx, actingAdminId, 'RESTAURANT_APPROVE', 'RESTAURANT', restaurantId, {
        restaurantName: rest.name,
        previousStatus: rest.status,
      });
      return res;
    });

    void this.notifications.sendToUsers([rest.ownerId], {
      title: 'Quán ăn đã được duyệt',
      body: `Quán "${rest.name}" đã được phê duyệt và bắt đầu hiển thị với khách hàng.`,
      data: { type: 'restaurant_approved', restaurantId },
    });

    return updated;
  }

  /** Từ chối duyệt quán -> giữ PENDING_APPROVAL kèm lý do */
  async rejectRestaurant(restaurantId: string, actingAdminId: string, dto: RejectRestaurantDto) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Vui lòng nhập lý do từ chối');

    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          status: RestaurantStatus.PENDING_APPROVAL,
          suspendReason: reason,
        },
        include: { owner: { select: OWNER_SELECT }, _count: { select: { menuItems: true, orders: true } } },
      });
      await this.audit(tx, actingAdminId, 'RESTAURANT_REJECT', 'RESTAURANT', restaurantId, {
        restaurantName: rest.name,
        reason,
      });
      return res;
    });

    void this.notifications.sendToUsers([rest.ownerId], {
      title: 'Quán ăn chưa được phê duyệt',
      body: `Quán "${rest.name}" chưa được duyệt: ${reason}`,
      data: { type: 'restaurant_rejected', restaurantId, reason },
    });

    return updated;
  }

  /** Cập nhật trạng thái hoạt động của quán (ACTIVE / SUSPENDED) */
  async updateRestaurantStatus(
    restaurantId: string,
    actingAdminId: string,
    dto: UpdateRestaurantStatusDto,
  ) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    const reason = dto.reason?.trim() || null;
    if (dto.status === RestaurantStatus.SUSPENDED && !reason) {
      throw new BadRequestException('Bắt buộc nhập lý do khi tạm ngưng quán');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          status: dto.status,
          suspendReason: dto.status === RestaurantStatus.SUSPENDED ? reason : null,
          ...(dto.status === RestaurantStatus.ACTIVE && !rest.approvedAt
            ? { approvedAt: new Date(), approvedById: actingAdminId }
            : {}),
        },
        include: { owner: { select: OWNER_SELECT }, _count: { select: { menuItems: true, orders: true } } },
      });
      await this.audit(
        tx,
        actingAdminId,
        dto.status === RestaurantStatus.SUSPENDED ? 'RESTAURANT_SUSPEND' : 'RESTAURANT_RESUME',
        'RESTAURANT',
        restaurantId,
        { restaurantName: rest.name, reason },
      );
      return res;
    });

    void this.notifications.sendToUsers([rest.ownerId], {
      title:
        dto.status === RestaurantStatus.SUSPENDED
          ? 'Quán ăn đã bị tạm ngưng'
          : 'Quán ăn đã được mở lại',
      body:
        dto.status === RestaurantStatus.SUSPENDED
          ? `Quán "${rest.name}" đã bị tạm ngưng: ${reason}`
          : `Quán "${rest.name}" đã hoạt động trở lại.`,
      data: { type: 'restaurant_status', restaurantId, status: dto.status },
    });

    return updated;
  }

  /** @deprecated Chuyển sang dùng cột status thay vì lạm dụng isOpen */
  async toggleRestaurantOpen(restaurantId: string, actingAdminId: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    const nextStatus =
      rest.status === RestaurantStatus.ACTIVE ? RestaurantStatus.SUSPENDED : RestaurantStatus.ACTIVE;

    return this.updateRestaurantStatus(restaurantId, actingAdminId, {
      status: nextStatus,
      reason: nextStatus === RestaurantStatus.SUSPENDED ? 'Quản trị viên tạm ngưng hoạt động' : undefined,
    });
  }

  /** Lấy danh sách toàn bộ đơn hàng toàn sàn */
  async listOrders(q: ListAdminOrdersQueryDto) {
    const term = q.q?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status as OrderStatus } : {}),
      ...(q.stalled ? { stalledAt: { not: null } } : {}),
      ...(term
        ? {
            OR: [
              ...(term.length === 36 ? [{ id: term }] : []),
              { customer: { phone: { contains: term, mode: 'insensitive' } } },
              { customer: { fullName: { contains: term, mode: 'insensitive' } } },
              { restaurant: { name: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          restaurant: { select: { id: true, name: true, phone: true, address: true } },
          driver: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              driverProfile: { select: { lastLatitude: true, lastLongitude: true, lastLocationAt: true } },
            },
          },
          items: { select: { name: true, quantity: true, unitPrice: true } },
          _count: { select: { contactAttempts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      hasMore: q.page * q.limit < total,
    };
  }

  /** Chi tiết đơn hàng đầy đủ cho Admin */
  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        restaurant: { select: { id: true, name: true, phone: true, address: true, latitude: true, longitude: true } },
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            driverProfile: {
              select: {
                vehicleType: true,
                licensePlate: true,
                lastLatitude: true,
                lastLongitude: true,
                lastLocationAt: true,
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        contactAttempts: { orderBy: { createdAt: 'asc' } },
        review: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  /** Admin gỡ tài xế khỏi đơn đang giao (khi CONFIRMED/PREPARING/READY_FOR_PICKUP) và phát lại đơn */
  async unassignDriver(orderId: string, actingAdminId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { ownerId: true, name: true } } },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!order.driverId) throw new BadRequestException('Đơn hàng hiện chưa có tài xế nhận');
    if (!['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
      throw new ConflictException(`Không thể gỡ tài xế khi đơn đang ở trạng thái ${order.status}`);
    }

    const prevDriverId = order.driverId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: orderId },
        data: { driverId: null },
        include: {
          restaurant: { select: { ownerId: true, name: true } },
        },
      });
      await this.audit(tx, actingAdminId, 'ORDER_UNASSIGN_DRIVER', 'ORDER', orderId, {
        previousDriverId: prevDriverId,
        reason: reason?.trim() || null,
      });
      return res;
    });

    this.gateway?.emitOrderUpdated('order:status', updated);
    this.gateway?.emitOrderAvailable(updated);

    return updated;
  }

  /** Admin ẩn / hiện đánh giá và tính lại điểm trung bình + số lượt đánh giá của quán */
  async updateReviewVisibility(reviewId: string, actingAdminId: string, dto: UpdateReviewVisibilityDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { isHidden: dto.isHidden },
      });

      const agg = await tx.review.aggregate({
        where: { restaurantId: review.restaurantId, isHidden: false },
        _avg: { rating: true },
        _count: { id: true },
      });
      await tx.restaurant.update({
        where: { id: review.restaurantId },
        data: {
          rating: agg._count.id > 0 ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : 0,
          ratingCount: agg._count.id,
        },
      });

      await this.audit(
        tx,
        actingAdminId,
        dto.isHidden ? 'REVIEW_HIDE' : 'REVIEW_SHOW',
        'REVIEW',
        reviewId,
        { restaurantId: review.restaurantId, reason: dto.reason.trim() },
      );

      return updated;
    });
  }

  /** Thống kê số liệu bảng điều khiển Admin */
  async getDashboardStats() {
    const [
      usersByRole,
      inactiveUsers,
      totalRestaurants,
      openRestaurants,
      unassignedRestaurants,
      pendingRestaurants,
      suspendedRestaurants,
      totalOrders,
      ordersByStatus,
      stalledOrders,
      revenueResult,
      pendingRoleRequests,
      codDebtResult,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.restaurant.count(),
      this.prisma.restaurant.count({ where: { isOpen: true, status: RestaurantStatus.ACTIVE } }),
      this.prisma.restaurant.count({ where: UNASSIGNED_WHERE }),
      this.prisma.restaurant.count?.({ where: { status: RestaurantStatus.PENDING_APPROVAL } }) ?? 0,
      this.prisma.restaurant.count?.({ where: { status: RestaurantStatus.SUSPENDED } }) ?? 0,
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.order.count?.({
        where: {
          stalledAt: { not: null },
          driverId: null,
          status: { in: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] },
        },
      }) ?? 0,
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: OrderStatus.DELIVERED },
      }),
      this.prisma.roleUpgradeRequest.count({ where: { status: RoleRequestStatus.PENDING } }),
      this.prisma.driverProfile?.aggregate
        ? this.prisma.driverProfile.aggregate({ _sum: { codBalance: true } })
        : Promise.resolve({ _sum: { codBalance: 0 } }),
    ]);

    const roles = Object.fromEntries(Object.values(Role).map((r) => [r, 0])) as Record<Role, number>;
    for (const r of usersByRole) roles[r.role] = r._count.id;
    const customersCount = roles.CUSTOMER;
    const ownersCount = roles.RESTAURANT_OWNER;
    const driversCount = roles.DRIVER;
    const adminsCount = roles.ADMIN;

    return {
      users: {
        total: customersCount + ownersCount + driversCount + adminsCount,
        customersCount,
        ownersCount,
        driversCount,
        adminsCount,
        inactive: inactiveUsers,
        roles,
      },
      restaurants: {
        total: totalRestaurants,
        open: openRestaurants,
        closed: totalRestaurants - openRestaurants,
        unassigned: unassignedRestaurants,
        pendingApproval: pendingRestaurants,
        suspended: suspendedRestaurants,
      },
      orders: {
        total: totalOrders,
        stalled: stalledOrders,
        statuses: Object.fromEntries(ordersByStatus.map((s) => [s.status, s._count.id])),
        totalRevenue: revenueResult._sum.total || 0,
      },
      drivers: {
        totalCodDebt: codDebtResult?._sum?.codBalance ?? 0,
      },
      roleRequests: { pending: pendingRoleRequests },
    };
  }

  /* ----------------------- Yêu cầu nâng cấp vai trò ----------------------- */

  listRoleRequests(q: ListRoleRequestsQueryDto) {
    return this.prisma.roleUpgradeRequest.findMany({
      where: q.status ? { status: q.status } : {},
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, role: true, avatarUrl: true, isActive: true },
        },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: q.status === RoleRequestStatus.PENDING ? 'asc' : 'desc' },
      take: 100,
    });
  }

  /** Duyệt / từ chối yêu cầu. Duyệt thì đổi vai trò (và tạo hồ sơ tài xế từ thông tin xe đã khai). */
  async reviewRoleRequest(id: string, actingAdminId: string, dto: ReviewRoleRequestDto) {
    const request = await this.prisma.roleUpgradeRequest.findUnique({ where: { id }, include: { user: true } });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (request.status !== RoleRequestStatus.PENDING) {
      throw new ConflictException('Yêu cầu này đã được xử lý trước đó');
    }
    const approve = dto.status === RoleRequestStatus.APPROVED;
    const reviewNote = dto.reviewNote?.trim() || null;
    if (!approve && !reviewNote) throw new BadRequestException('Vui lòng nhập lý do từ chối');

    if (approve) {
      if (request.user.role !== Role.CUSTOMER) {
        throw new ConflictException(
          `Tài khoản hiện là ${ROLE_LABEL[request.user.role]}, chỉ nâng cấp được tài khoản Khách hàng`,
        );
      }
      if (!request.user.isActive) throw new BadRequestException('Tài khoản đang bị khoá, không thể duyệt');
    }

    const meta = (request.metadata ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    let driverData: Omit<Prisma.DriverProfileUncheckedCreateInput, 'userId'> | null = null;
    if (approve && request.requestedRole === Role.DRIVER) {
      const vehicleType = Object.values(VehicleType).includes(meta.vehicleType as VehicleType)
        ? (meta.vehicleType as VehicleType)
        : VehicleType.MOTORBIKE;
      const licensePlate = vehicleType === VehicleType.BICYCLE ? null : normalizeLicensePlate(str(meta.licensePlate));
      if (licensePlate) {
        if (!isValidVietnameseLicensePlate(licensePlate)) {
          throw new BadRequestException('Biển số xe trong yêu cầu không hợp lệ, hãy từ chối và yêu cầu gửi lại');
        }
        const dup = await this.prisma.driverProfile.findFirst({
          where: { licensePlate, userId: { not: request.userId } },
        });
        if (dup) throw new ConflictException('Biển số xe này đã được đăng ký bởi tài xế khác');
      }
      driverData = {
        vehicleType,
        vehicleBrand: str(meta.vehicleBrand),
        vehicleModel: str(meta.vehicleModel),
        vehicleColor: str(meta.vehicleColor),
        licensePlate,
        verificationStatus: DriverVerificationStatus.APPROVED,
        verifiedAt: new Date(),
        verifiedById: actingAdminId,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.roleUpgradeRequest.update({
        where: { id },
        data: { status: dto.status, reviewNote, reviewedById: actingAdminId, reviewedAt: new Date() },
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
      });
      if (approve) {
        await tx.user.update({
          where: { id: request.userId },
          data: { role: request.requestedRole, refreshTokenHash: null },
        });
        if (driverData) {
          await tx.driverProfile.upsert({
            where: { userId: request.userId },
            create: { userId: request.userId, ...driverData },
            update: driverData,
          });
        }
      }
      await this.audit(
        tx,
        actingAdminId,
        approve ? 'ROLE_REQUEST_APPROVED' : 'ROLE_REQUEST_REJECTED',
        'USER',
        request.userId,
        { requestId: id, requestedRole: request.requestedRole, reviewNote },
      );
      return result;
    });

    if (approve) {
      this.authState?.invalidate(request.userId);
      this.gateway?.disconnectUser(request.userId);
    }

    const roleName = ROLE_LABEL[request.requestedRole];
    void this.notifications.sendToUsers(
      [request.userId],
      approve
        ? {
            title: 'Yêu cầu đã được duyệt',
            body: `Bạn đã trở thành ${roleName}. Vui lòng đăng nhập lại để sử dụng tính năng mới.`,
            data: { type: 'role_request', status: dto.status, role: request.requestedRole },
          }
        : {
            title: 'Yêu cầu chưa được duyệt',
            body: `Yêu cầu trở thành ${roleName} bị từ chối: ${reviewNote}`,
            data: { type: 'role_request', status: dto.status, role: request.requestedRole },
          },
    );

    return updated;
  }

  /** Thêm nhà hàng mới cùng thông tin chủ quán (Admin tạo -> ACTIVE ngay, ghi AuditLog) */
  async createRestaurant(dto: AdminCreateRestaurantDto, actingAdminId?: string) {
    let temporaryPassword: string | null = null;
    const ownerEmail = dto.ownerEmail.toLowerCase().trim();
    const ownerPhone = dto.ownerPhone.trim();

    const existingOwner = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: ownerEmail }, ...(ownerPhone ? [{ phone: ownerPhone }] : [])],
      },
    });

    let defaultPasswordHash: string | null = null;
    let newUsername: string | null = null;
    if (!existingOwner) {
      temporaryPassword = generateSecureTemporaryPassword();
      defaultPasswordHash = await hashSecret(temporaryPassword);
      newUsername = await generateUniqueUsername(this.prisma, ownerEmail);
    }

    return this.prisma.$transaction(async (tx) => {
      let owner = existingOwner;
      let promotedOwner = false;

      if (!owner) {
        owner = await tx.user.create({
          data: {
            fullName: dto.ownerName.trim(),
            email: ownerEmail,
            username: newUsername,
            phone: ownerPhone,
            passwordHash: defaultPasswordHash!,
            role: Role.RESTAURANT_OWNER,
          },
        });
        if (actingAdminId) {
          await this.audit(tx, actingAdminId, 'USER_CREATE', 'USER', owner.id, {
            email: owner.email,
            role: owner.role,
            via: 'ADMIN_CREATE_RESTAURANT',
          });
        }
      } else if (owner.role !== Role.RESTAURANT_OWNER && owner.role !== Role.ADMIN) {
        const previousRole = owner.role;
        owner = await tx.user.update({
          where: { id: owner.id },
          data: { role: Role.RESTAURANT_OWNER, refreshTokenHash: null },
        });
        promotedOwner = true;
        if (actingAdminId) {
          await this.audit(tx, actingAdminId, 'USER_CHANGE_ROLE', 'USER', owner.id, {
            from: previousRole,
            to: Role.RESTAURANT_OWNER,
            via: 'ADMIN_CREATE_RESTAURANT',
          });
        }
      }

      const restaurant = await tx.restaurant.create({
        data: {
          ownerId: owner.id,
          name: dto.name.trim(),
          address: dto.address.trim(),
          phone: dto.phone?.trim() || ownerPhone,
          latitude: dto.latitude,
          longitude: dto.longitude,
          imageUrl: dto.imageUrl?.trim() || null,
          isOpen: true,
          status: RestaurantStatus.ACTIVE,
          approvedAt: new Date(),
          approvedById: actingAdminId ?? null,
        },
        include: {
          owner: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      });

      if (actingAdminId) {
        await this.audit(tx, actingAdminId, 'RESTAURANT_CREATE', 'RESTAURANT', restaurant.id, {
          name: restaurant.name,
          ownerId: owner.id,
          status: RestaurantStatus.ACTIVE,
        });
      }

      if (promotedOwner) {
        this.authState?.invalidate(owner.id);
        this.gateway?.disconnectUser(owner.id);
      }

      return { ...restaurant, temporaryPassword };
    });
  }

  /** Chỉnh sửa thông tin nhà hàng (Admin sửa -> ghi AuditLog) */
  async updateRestaurant(id: string, dto: AdminUpdateRestaurantDto, actingAdminId?: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurant.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.address ? { address: dto.address.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.isOpen !== undefined ? { isOpen: dto.isOpen } : {}),
        },
        include: {
          owner: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      });
      if (actingAdminId) {
        await this.audit(tx, actingAdminId, 'RESTAURANT_UPDATE', 'RESTAURANT', id, {
          restaurantName: updated.name,
        });
      }
      return updated;
    });
  }

  /** Xóa nhà hàng (kèm AuditLog) */
  async deleteRestaurant(id: string, actingAdminId?: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');
    const orders = await this.prisma.order.count({ where: { restaurantId: id } });
    if (orders > 0) {
      throw new ConflictException(
        `Quán đã có ${orders} đơn hàng nên không thể xoá. Hãy tạm đóng quán để ngừng nhận đơn.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.restaurant.delete({ where: { id } });
      if (actingAdminId) {
        await this.audit(tx, actingAdminId, 'RESTAURANT_DELETE', 'RESTAURANT', id, {
          restaurantName: rest.name,
        });
      }
      return deleted;
    });
  }

  /** Xóa mềm món ăn khỏi hệ thống (kèm AuditLog) */
  async deleteMenuItem(id: string, actingAdminId?: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy món ăn');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.menuItem.update({
        where: { id },
        data: { isArchived: true, isAvailable: false },
      });
      if (actingAdminId) {
        await this.audit(tx, actingAdminId, 'MENU_ITEM_DELETE', 'MENU_ITEM', id, {
          name: item.name,
          restaurantId: item.restaurantId,
        });
      }
      return updated;
    });
  }
}
