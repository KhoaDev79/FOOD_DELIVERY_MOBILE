import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService - deleteAccount', () => {
  let service: UsersService;
  let prisma: any;
  let authState: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        count: jest.fn(),
      },
      address: {
        deleteMany: jest.fn(),
      },
      favorite: {
        deleteMany: jest.fn(),
      },
      driverProfile: {
        update: jest.fn(),
      },
      restaurant: {
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    authState = {
      invalidate: jest.fn(),
    };

    const mediaMock: any = { resolveImage: jest.fn(), uploadBuffer: jest.fn() };
    service = new UsersService(prisma, authState, mediaMock);
  });

  it('báo lỗi NotFound nếu người dùng không tồn tại hoặc đã bị vô hiệu hoá', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.deleteAccount('user-1')).rejects.toThrow(NotFoundException);
  });

  it('chặn xoá tài khoản khi khách hàng đang có đơn hàng chưa hoàn tất', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      role: Role.CUSTOMER,
      isActive: true,
      restaurants: [],
    });
    // active customer orders > 0
    prisma.order.count.mockResolvedValue(1);

    await expect(service.deleteAccount('cust-1')).rejects.toThrow('đơn hàng chưa hoàn tất');
  });

  it('chặn xoá tài khoản khi tài xế đang còn nợ COD', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'driver-1',
      role: Role.DRIVER,
      isActive: true,
      driverProfile: { codBalance: 250000 },
      restaurants: [],
    });
    prisma.order.count.mockResolvedValue(0);

    await expect(service.deleteAccount('driver-1')).rejects.toThrow(BadRequestException);
    await expect(service.deleteAccount('driver-1')).rejects.toThrow('công nợ COD');
  });

  it('xoá và ẩn danh thông tin thành công khi thoả mãn điều kiện', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      role: Role.CUSTOMER,
      isActive: true,
      restaurants: [],
    });
    prisma.order.count.mockResolvedValue(0);

    const result = await service.deleteAccount('cust-1');

    expect(result.ok).toBe(true);
    expect(prisma.address.deleteMany).toHaveBeenCalledWith({ where: { userId: 'cust-1' } });
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: 'cust-1' } });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          fullName: 'Tài khoản đã xoá',
          phone: null,
          username: null,
          avatarUrl: null,
          refreshTokenHash: null,
          isActive: false,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_DELETE_ACCOUNT',
          targetId: 'cust-1',
        }),
      }),
    );
    expect(authState.invalidate).toHaveBeenCalledWith('cust-1');
  });
});
