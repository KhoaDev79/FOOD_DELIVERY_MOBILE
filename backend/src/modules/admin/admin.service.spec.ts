import { BadRequestException, ConflictException } from '@nestjs/common';
import { RestaurantStatus, Role, RoleRequestStatus, VehicleType } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let notifications: { sendToUsers: jest.Mock };
  let authState: { invalidate: jest.Mock };
  let gateway: { disconnectUser: jest.Mock; emitOrderAvailable: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      restaurant: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), delete: jest.fn() },
      order: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      roleUpgradeRequest: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      driverProfile: { findFirst: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    // Transaction chạy callback với chính mock client
    prisma.$transaction = jest.fn((cb: (tx: any) => unknown) => cb(prisma));
    notifications = { sendToUsers: jest.fn().mockResolvedValue(undefined) };
    authState = { invalidate: jest.fn() };
    gateway = { disconnectUser: jest.fn(), emitOrderAvailable: jest.fn() };
    service = new AdminService(prisma, notifications as any, authState as any, gateway as any);
  });

  describe('getDashboardStats', () => {
    it('tổng người dùng = khách + chủ quán + tài xế + admin, đủ 4 vai trò kể cả 0', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { role: Role.CUSTOMER, _count: { id: 3 } },
        { role: Role.RESTAURANT_OWNER, _count: { id: 2 } },
        { role: Role.ADMIN, _count: { id: 1 } },
      ]);
      prisma.user.count.mockResolvedValue(0);
      prisma.restaurant.count.mockResolvedValue(18);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.groupBy.mockResolvedValue([]);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });
      prisma.roleUpgradeRequest.count.mockResolvedValue(1);

      const res = await service.getDashboardStats();
      expect(res.users).toMatchObject({
        total: 6,
        customersCount: 3,
        ownersCount: 2,
        driversCount: 0,
        adminsCount: 1,
      });
      expect(res.roleRequests.pending).toBe(1);
    });
  });

  describe('assignRestaurantOwner', () => {
    const restaurant = { id: 'r1', name: 'Quán A', ownerId: 'old', owner: { id: 'old', fullName: 'Chủ cũ' } };

    it('nâng khách hàng lên chủ quán, đổi chủ, invalidate cache và ghi nhật ký', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restaurant);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', fullName: 'Khách', role: Role.CUSTOMER, isActive: true });
      prisma.restaurant.update.mockResolvedValue({ ...restaurant, ownerId: 'u1' });

      const res = await service.assignRestaurantOwner('r1', 'u1', 'admin');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.RESTAURANT_OWNER }) }),
      );
      expect(prisma.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({ data: { ownerId: 'u1' } }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'RESTAURANT_ASSIGN_OWNER', actorId: 'admin' }) }),
      );
      expect(authState.invalidate).toHaveBeenCalledWith('u1');
      expect(gateway.disconnectUser).toHaveBeenCalledWith('u1');
      expect(res.promoted).toBe(true);
    });

    it('không đổi vai trò nếu người nhận đã là chủ quán', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restaurant);
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', fullName: 'Chủ', role: Role.RESTAURANT_OWNER, isActive: true });
      prisma.restaurant.update.mockResolvedValue({ ...restaurant, ownerId: 'u2' });

      const res = await service.assignRestaurantOwner('r1', 'u2', 'admin');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(res.promoted).toBe(false);
    });

    it('từ chối gán cho tài xế, admin (409) hoặc tài khoản bị khoá (400)', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restaurant);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'd', role: Role.DRIVER, isActive: true });
      await expect(service.assignRestaurantOwner('r1', 'd', 'admin')).rejects.toBeInstanceOf(ConflictException);

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'a', role: Role.ADMIN, isActive: true });
      await expect(service.assignRestaurantOwner('r1', 'a', 'admin')).rejects.toBeInstanceOf(ConflictException);

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'x', role: Role.CUSTOMER, isActive: false });
      await expect(service.assignRestaurantOwner('r1', 'x', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('restaurant moderation (approve / reject / suspend)', () => {
    it('duyệt quán chuyển status sang ACTIVE và ghi AuditLog', async () => {
      prisma.restaurant.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'Quán Mới',
        ownerId: 'o1',
        status: RestaurantStatus.PENDING_APPROVAL,
      });
      prisma.restaurant.update.mockResolvedValue({
        id: 'r1',
        name: 'Quán Mới',
        ownerId: 'o1',
        status: RestaurantStatus.ACTIVE,
      });

      const res = await service.approveRestaurant('r1', 'admin');
      expect(res.status).toBe(RestaurantStatus.ACTIVE);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'RESTAURANT_APPROVE', targetId: 'r1' }),
        }),
      );
      expect(notifications.sendToUsers).toHaveBeenCalledWith(['o1'], expect.anything());
    });

    it('từ chối quán bắt buộc nhập lý do và giữ PENDING_APPROVAL + lưu suspendReason', async () => {
      prisma.restaurant.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'Quán Mới',
        ownerId: 'o1',
        status: RestaurantStatus.PENDING_APPROVAL,
      });
      prisma.restaurant.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'r1', ownerId: 'o1', ...data }),
      );

      const res = await service.rejectRestaurant('r1', 'admin', { reason: 'Thiếu giấy phép ATTP' });
      expect(res.status).toBe(RestaurantStatus.PENDING_APPROVAL);
      expect(res.suspendReason).toBe('Thiếu giấy phép ATTP');
    });
  });

  describe('changeUserRole', () => {
    it('chặn hạ vai trò chủ quán khi còn sở hữu quán', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'o', role: Role.RESTAURANT_OWNER, _count: { restaurants: 2 } });
      await expect(service.changeUserRole('o', 'admin', { role: Role.CUSTOMER })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('reviewRoleRequest', () => {
    it('duyệt yêu cầu tài xế: đổi vai trò và tạo hồ sơ xe đã duyệt', async () => {
      prisma.roleUpgradeRequest.findUnique.mockResolvedValue({
        id: 'req',
        userId: 'u1',
        requestedRole: Role.DRIVER,
        status: RoleRequestStatus.PENDING,
        metadata: { vehicleType: VehicleType.BICYCLE },
        user: { id: 'u1', role: Role.CUSTOMER, isActive: true },
      });
      prisma.roleUpgradeRequest.update.mockResolvedValue({ id: 'req', status: RoleRequestStatus.APPROVED });

      await service.reviewRoleRequest('req', 'admin', { status: RoleRequestStatus.APPROVED });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.DRIVER }) }),
      );
      expect(prisma.driverProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: 'u1', vehicleType: VehicleType.BICYCLE, verificationStatus: 'APPROVED' }),
        }),
      );
      expect(authState.invalidate).toHaveBeenCalledWith('u1');
      expect(gateway.disconnectUser).toHaveBeenCalledWith('u1');
      expect(notifications.sendToUsers).toHaveBeenCalledWith(['u1'], expect.anything());
    });

    it('bắt buộc lý do khi từ chối', async () => {
      prisma.roleUpgradeRequest.findUnique.mockResolvedValue({
        id: 'req',
        status: RoleRequestStatus.PENDING,
        user: { role: Role.CUSTOMER, isActive: true },
      });
      await expect(
        service.reviewRoleRequest('req', 'admin', { status: RoleRequestStatus.REJECTED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không xử lý lại yêu cầu đã duyệt', async () => {
      prisma.roleUpgradeRequest.findUnique.mockResolvedValue({ id: 'req', status: RoleRequestStatus.APPROVED });
      await expect(
        service.reviewRoleRequest('req', 'admin', { status: RoleRequestStatus.APPROVED }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
