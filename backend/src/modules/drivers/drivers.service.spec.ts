import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DriverVerificationStatus, Role, VehicleType } from '@prisma/client';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  let service: DriversService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      driverProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      driverLedger: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    mockPrisma.$transaction = jest.fn((cb: (tx: any) => unknown) => cb(mockPrisma));
    service = new DriversService(mockPrisma);
  });

  describe('getMe', () => {
    it('tạo hồ sơ PENDING nếu tài xế chưa có hồ sơ', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', role: Role.DRIVER });
      mockPrisma.driverProfile.findUnique.mockResolvedValue(null);
      mockPrisma.driverProfile.create.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        vehicleType: VehicleType.MOTORBIKE,
        verificationStatus: DriverVerificationStatus.PENDING,
        isOnline: false,
        bankAccountNumber: null,
      });

      const res = await service.getMe('driver-1');
      expect(res.verificationStatus).toBe('PENDING');
      expect(mockPrisma.driverProfile.create).toHaveBeenCalled();
    });

    it('từ chối người dùng không phải vai trò DRIVER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', role: Role.CUSTOMER });
      await expect(service.getMe('cust-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateVehicle', () => {
    it('chuyển hồ sơ về PENDING và tắt trực tuyến khi đổi biển số xe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', role: Role.DRIVER });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        vehicleType: VehicleType.MOTORBIKE,
        licensePlate: '59-X1 111.11',
        verificationStatus: DriverVerificationStatus.APPROVED,
        isOnline: true,
      });
      mockPrisma.driverProfile.findFirst.mockResolvedValue(null);
      mockPrisma.driverProfile.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'p-1', userId: 'driver-1' }),
      );

      const res = await service.updateVehicle('driver-1', {
        licensePlate: '59-X1 222.22',
      });

      expect(res.verificationStatus).toBe(DriverVerificationStatus.PENDING);
      expect(res.isOnline).toBe(false);
    });

    it('từ chối biển số xe sai định dạng', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', role: Role.DRIVER });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        vehicleType: VehicleType.MOTORBIKE,
        licensePlate: '59-X1 111.11',
      });

      await expect(
        service.updateVehicle('driver-1', { licensePlate: 'INVALID-PLATE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối biển số trùng với tài xế khác', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', role: Role.DRIVER });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        vehicleType: VehicleType.MOTORBIKE,
        licensePlate: '59-X1 111.11',
      });
      mockPrisma.driverProfile.findFirst.mockResolvedValue({ id: 'p-other', userId: 'driver-2' });

      await expect(
        service.updateVehicle('driver-1', { licensePlate: '59-X1 999.99' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    it('chặn bật trực tuyến khi hồ sơ chưa APPROVED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', isActive: true });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        userId: 'driver-1',
        verificationStatus: DriverVerificationStatus.PENDING,
      });

      await expect(service.updateStatus('driver-1', { isOnline: true })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('chặn bật trực tuyến khi tài khoản bị khóa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', isActive: false });

      await expect(service.updateStatus('driver-1', { isOnline: true })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('chặn bật trực tuyến khi thiếu toạ độ GPS', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', isActive: true });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        userId: 'driver-1',
        verificationStatus: DriverVerificationStatus.APPROVED,
      });

      await expect(service.updateStatus('driver-1', { isOnline: true })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cho phép bật trực tuyến khi hồ sơ APPROVED, tài khoản active và có toạ độ GPS', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'driver-1', isActive: true });
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        userId: 'driver-1',
        verificationStatus: DriverVerificationStatus.APPROVED,
      });
      mockPrisma.driverProfile.update.mockResolvedValue({
        userId: 'driver-1',
        isOnline: true,
        lastLatitude: 10.77,
        lastLongitude: 106.7,
        verificationStatus: DriverVerificationStatus.APPROVED,
      });

      const res = await service.updateStatus('driver-1', {
        isOnline: true,
        latitude: 10.77,
        longitude: 106.7,
      });
      expect(res.isOnline).toBe(true);
    });
  });

  describe('adminVerifyDriver', () => {
    it('tự động tắt trực tuyến khi từ chối hoặc tạm khóa', async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValue({ userId: 'driver-1', isOnline: true });
      mockPrisma.driverProfile.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, userId: 'driver-1' }),
      );

      const res = await service.adminVerifyDriver('driver-1', 'admin-1', {
        status: DriverVerificationStatus.SUSPENDED,
        reason: 'Vi phạm quy định giao nhận',
      });

      expect(res.verificationStatus).toBe(DriverVerificationStatus.SUSPENDED);
      expect(res.isOnline).toBe(false);
    });
  });

  describe('adminRecordSettlement (C4 Ledger)', () => {
    it('từ chối nộp tiền vượt quá công nợ hiện tại của tài xế', async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        codBalance: 500000,
      });

      await expect(
        service.adminRecordSettlement('driver-1', 'admin-1', {
          amount: 600000,
          note: 'Nộp dư',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ghi nhận nộp tiền hợp lệ với số âm trong DriverLedger và giảm codBalance', async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        codBalance: 500000,
      });
      mockPrisma.driverProfile.update.mockResolvedValue({
        id: 'p-1',
        userId: 'driver-1',
        codBalance: 200000,
      });
      mockPrisma.driverLedger.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const res = await service.adminRecordSettlement('driver-1', 'admin-1', {
        amount: 300000,
        note: 'Nộp tiền mặt tại văn phòng',
      });

      expect(res.balance).toBe(200000);
      expect(mockPrisma.driverLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverId: 'driver-1',
            type: 'SETTLEMENT',
            amount: -300000,
            balanceAfter: 200000,
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DRIVER_SETTLEMENT',
          }),
        }),
      );
    });
  });
});

