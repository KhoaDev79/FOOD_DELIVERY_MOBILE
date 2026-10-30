import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role, RoleRequestStatus, VehicleType } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let notifications: { sendToUsers: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      restaurant: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      order: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
      roleUpgradeRequest: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      driverProfile: { findFirst: jest.fn(), upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    // Transaction chạy callback với chính mock client
    prisma.$transaction = jest.fn((cb: (tx: any) => unknown) => cb(prisma));
    notifications = { sendToUsers: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma, notifications as any);
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

    it('nâng khách hàng lên chủ quán, đổi chủ và ghi nhật ký', async () => {
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

    it('từ chối gán cho tài xế hoặc tài khoản bị khoá', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restaurant);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'd', role: Role.DRIVER, isActive: true });
      await expect(service.assignRestaurantOwner('r1', 'd', 'admin')).rejects.toBeInstanceOf(BadRequestException);

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'x', role: Role.CUSTOMER, isActive: false });
      await expect(service.assignRestaurantOwner('r1', 'x', 'admin')).rejects.toBeInstanceOf(BadRequestException);
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
