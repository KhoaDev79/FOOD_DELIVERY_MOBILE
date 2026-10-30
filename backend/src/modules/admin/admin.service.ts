import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  OrderStatus,
  Prisma,
  Role,
  RoleRequestStatus,
  VehicleType,
} from '@prisma/client';
import { hashSecret } from '../../common/utils/password.util';
import { generateUniqueUsername } from '../../common/utils/username.util';
import { isValidVietnameseLicensePlate, normalizeLicensePlate } from '../../common/utils/vietnamese-plate.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminCreateRestaurantDto,
  AdminUpdateRestaurantDto,
  ChangeUserRoleDto,
  ListAdminOrdersQueryDto,
  ListAdminRestaurantsQueryDto,
  ListRoleRequestsQueryDto,
  ListUsersQueryDto,
  RestaurantFilter,
  ReviewRoleRequestDto,
  ToggleUserActiveDto,
} from './dto/admin.dto';

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  RESTAURANT_OWNER: 'Chủ quán',
  DRIVER: 'Tài xế',
  ADMIN: 'Quản trị viên',
};

/**
 * Quán "chưa có chủ" = chủ hiện tại không phải tài khoản chủ quán đang hoạt động
 * (VD: quán do admin tạo/giữ tạm, hoặc chủ cũ đã bị khoá / đổi vai trò).
 */
const UNASSIGNED_WHERE: Prisma.RestaurantWhereInput = {
  OR: [{ owner: { role: { not: Role.RESTAURANT_OWNER } } }, { owner: { isActive: false } }],
};

const OWNER_SELECT = { id: true, fullName: true, email: true, phone: true, role: true, isActive: true } as const;

const needsOwner = (owner: { role: Role; isActive: boolean }) => owner.role !== Role.RESTAURANT_OWNER || !owner.isActive;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ghi nhật ký thao tác quản trị (trong cùng transaction với thao tác). */
  private audit(
    db: Prisma.TransactionClient,
    actorId: string,
    action: string,
    targetType: 'USER' | 'RESTAURANT',
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

  /** Khóa hoặc Mở khóa tài khoản (kèm lý do, ghi nhật ký) */
  async toggleUserActive(userId: string, actingAdminId: string, dto: ToggleUserActiveDto = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (userId === actingAdminId) throw new BadRequestException('Không thể tự khoá tài khoản của chính mình');
    if (user.role === Role.ADMIN && user.isActive) {
      throw new BadRequestException('Không thể khoá tài khoản quản trị viên khác');
    }
    const locking = user.isActive;
    const reason = dto.reason?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: !user.isActive,
          // Khoá tài khoản thì thu hồi luôn refresh token để đăng xuất ngay
          ...(locking ? { refreshTokenHash: null } : {}),
        },
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
      });
      await this.audit(tx, actingAdminId, locking ? 'USER_LOCK' : 'USER_UNLOCK', 'USER', userId, { reason });
      return updated;
    });
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
        // Vai trò nằm trong JWT: thu hồi refresh token để người dùng đăng nhập lại với quyền mới
        data: { role: dto.role, refreshTokenHash: null },
      });
      if (dto.role === Role.DRIVER) {
        await tx.driverProfile.upsert({ where: { userId }, update: {}, create: { userId } });
      }
      await this.audit(tx, actingAdminId, 'USER_CHANGE_ROLE', 'USER', userId, { from: user.role, to: dto.role });
    });

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
      this.prisma.restaurant.findMany({ where: { ownerId: userId }, select: { id: true, name: true, isOpen: true } }),
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

  /** Lấy danh sách toàn bộ nhà hàng trong hệ thống (tìm kiếm + lọc nhanh) */
  async listRestaurants(q: ListAdminRestaurantsQueryDto) {
    const where: Prisma.RestaurantWhereInput = {
      ...(q.q?.trim() ? { name: { contains: q.q.trim(), mode: 'insensitive' } } : {}),
      ...(q.filter === RestaurantFilter.OPEN ? { isOpen: true } : {}),
      ...(q.filter === RestaurantFilter.CLOSED ? { isOpen: false } : {}),
      ...(q.filter === RestaurantFilter.UNASSIGNED ? UNASSIGNED_WHERE : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: {
          owner: { select: OWNER_SELECT },
          _count: { select: { menuItems: true, orders: true } },
        },
        orderBy: [{ name: 'asc' }],
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
    if (!newOwner.isActive) throw new BadRequestException('Tài khoản này đang bị khoá, không thể gán làm chủ quán');
    if (newOwner.role === Role.DRIVER) {
      throw new BadRequestException('Tài khoản tài xế không thể làm chủ quán. Hãy đổi vai trò trước.');
    }
    if (restaurant.ownerId === ownerId) throw new BadRequestException('Người dùng này đã là chủ của quán');
    const promoted = newOwner.role === Role.CUSTOMER;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (promoted) {
        await tx.user.update({
          where: { id: ownerId },
          // Vai trò nằm trong JWT: buộc đăng nhập lại để nhận quyền chủ quán
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

    void this.notifications.sendToUsers([ownerId], {
      title: 'Bạn đã được giao quản lý quán 🏪',
      body: promoted
        ? `Quán "${restaurant.name}" đã được giao cho bạn. Vui lòng đăng nhập lại để vào trang chủ quán.`
        : `Quán "${restaurant.name}" đã được giao cho bạn quản lý.`,
      data: { type: 'restaurant_assigned', restaurantId },
    });

    return { ...updated, needsOwner: false, promoted };
  }

  /** Bật / Tắt trạng thái mở cửa của quán từ quyền Admin */
  async toggleRestaurantOpen(restaurantId: string, actingAdminId: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { isOpen: !rest.isOpen },
      });
      await this.audit(
        tx,
        actingAdminId,
        rest.isOpen ? 'RESTAURANT_SUSPEND' : 'RESTAURANT_RESUME',
        'RESTAURANT',
        restaurantId,
        { restaurantName: rest.name },
      );
      return updated;
    });
  }

  /** Lấy danh sách toàn bộ đơn hàng toàn sàn */
  async listOrders(q: ListAdminOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = q.status
      ? { status: q.status as any }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          restaurant: { select: { id: true, name: true } },
          driver: { select: { id: true, fullName: true, phone: true } },
          items: { select: { name: true, quantity: true } },
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

  /** Thống kê số liệu bảng điều khiển Admin */
  async getDashboardStats() {
    const [
      usersByRole,
      inactiveUsers,
      totalRestaurants,
      openRestaurants,
      unassignedRestaurants,
      totalOrders,
      ordersByStatus,
      revenueResult,
      pendingRoleRequests,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.restaurant.count(),
      this.prisma.restaurant.count({ where: { isOpen: true } }),
      this.prisma.restaurant.count({ where: UNASSIGNED_WHERE }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: OrderStatus.DELIVERED },
      }),
      this.prisma.roleUpgradeRequest.count({ where: { status: RoleRequestStatus.PENDING } }),
    ]);

    // Luôn trả đủ 4 vai trò (kể cả 0); tổng = tổng các vai trò để số liệu cộng dồn khớp 100%.
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
      },
      orders: {
        total: totalOrders,
        statuses: Object.fromEntries(ordersByStatus.map((s) => [s.status, s._count.id])),
        totalRevenue: revenueResult._sum.total || 0,
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
      // Chờ duyệt: cũ nhất trước (xử lý theo thứ tự); đã xử lý: mới nhất trước
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

    // Thông tin xe khai trong yêu cầu làm tài xế
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
        // Admin đã xem thông tin xe khi duyệt yêu cầu nên hồ sơ xe được duyệt luôn
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
          // Vai trò nằm trong JWT: buộc đăng nhập lại để nhận quyền mới
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

    const roleName = ROLE_LABEL[request.requestedRole];
    void this.notifications.sendToUsers(
      [request.userId],
      approve
        ? {
            title: 'Yêu cầu đã được duyệt 🎉',
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

  /** Thêm nhà hàng mới cùng thông tin chủ quán */
  async createRestaurant(dto: AdminCreateRestaurantDto) {
    // Mật khẩu tạm của chủ quán mới: trả về MỘT lần cho admin để gửi chủ quán (trước đây bị bỏ mất,
    // chủ quán mới không đăng nhập được).
    let temporaryPassword: string | null = null;
    let owner = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.ownerEmail.toLowerCase().trim() },
          ...(dto.ownerPhone ? [{ phone: dto.ownerPhone.trim() }] : []),
        ],
      },
    });

    if (!owner) {
      const defaultPassword = 'Owner@' + Math.floor(100000 + Math.random() * 900000);
      temporaryPassword = defaultPassword;
      const passwordHash = await hashSecret(defaultPassword);
      owner = await this.prisma.user.create({
        data: {
          fullName: dto.ownerName.trim(),
          email: dto.ownerEmail.toLowerCase().trim(),
          username: await generateUniqueUsername(this.prisma, dto.ownerEmail.toLowerCase().trim()),
          phone: dto.ownerPhone.trim(),
          passwordHash,
          role: Role.RESTAURANT_OWNER,
        },
      });
    } else if (owner.role !== Role.RESTAURANT_OWNER && owner.role !== Role.ADMIN) {
      owner = await this.prisma.user.update({
        where: { id: owner.id },
        data: { role: Role.RESTAURANT_OWNER },
      });
    }

    const restaurant = await this.prisma.restaurant.create({
      data: {
        ownerId: owner.id,
        name: dto.name.trim(),
        address: dto.address.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        imageUrl: dto.imageUrl?.trim() || null,
        isOpen: true,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    return { ...restaurant, temporaryPassword };
  }

  /** Chỉnh sửa thông tin nhà hàng */
  async updateRestaurant(id: string, dto: AdminUpdateRestaurantDto) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');

    return this.prisma.restaurant.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.address ? { address: dto.address.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isOpen !== undefined ? { isOpen: dto.isOpen } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
  }

  /** Xóa nhà hàng */
  async deleteRestaurant(id: string) {
    const rest = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!rest) throw new NotFoundException('Không tìm thấy nhà hàng');
    // Đơn hàng cũ phải được giữ lại (lịch sử, đối soát), nên quán đã có đơn thì không xoá được.
    const orders = await this.prisma.order.count({ where: { restaurantId: id } });
    if (orders > 0) {
      throw new ConflictException(
        `Quán đã có ${orders} đơn hàng nên không thể xoá. Hãy đóng cửa quán để ngừng nhận đơn.`,
      );
    }

    return this.prisma.restaurant.delete({ where: { id } });
  }

  /** Xóa món ăn khỏi hệ thống */
  async deleteMenuItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy món ăn');

    return this.prisma.menuItem.update({
      where: { id },
      data: { isArchived: true, isAvailable: false },
    });
  }
}

