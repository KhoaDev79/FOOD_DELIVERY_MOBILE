import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { AppliedVoucher } from './voucher-rules';

const voucherRow = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  code: 'GIAM20K',
  title: 'Giảm 20k',
  description: null,
  discountType: 'FIXED_AMOUNT',
  discountValue: 20_000,
  maxDiscountAmount: null,
  minOrderAmount: 0,
  maxUsage: 10,
  usedCount: 0,
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2099-01-01T00:00:00Z'),
  isActive: true,
  restaurantId: null,
  userId: null,
  perUserLimit: 1,
  onlyNewCustomer: false,
  fundedBy: 'PLATFORM',
  kind: 'CAMPAIGN',
  ...over,
});

describe('VouchersService', () => {
  let prisma: any;
  let service: VouchersService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      voucher: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      },
      voucherUsage: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      order: { count: jest.fn().mockResolvedValue(2) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new VouchersService(prisma);
  });

  const applied = (): AppliedVoucher[] => [{ voucher: voucherRow() as any, discount: 20_000, shippingDiscount: 0 }];

  describe('redeem', () => {
    it('khoá dòng voucher, tăng lượt và ghi lịch sử dùng', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow());
      await service.redeem(prisma, applied(), 'u1', 'o1');
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.voucher.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { usedCount: { increment: 1 } } });
      expect(prisma.voucherUsage.create).toHaveBeenCalledWith({
        data: { voucherId: 'v1', userId: 'u1', orderId: 'o1', discountAmount: 20_000 },
      });
    });

    it('mã vừa hết lượt do người khác dùng trước -> 409, không tăng lượt', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow({ maxUsage: 10, usedCount: 10 }));
      await expect(service.redeem(prisma, applied(), 'u1', 'o1')).rejects.toThrow(ConflictException);
      expect(prisma.voucher.update).not.toHaveBeenCalled();
    });

    it('khách đã dùng hết lượt của mình -> 409', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow());
      prisma.voucherUsage.count.mockResolvedValue(1);
      await expect(service.redeem(prisma, applied(), 'u1', 'o1')).rejects.toThrow('đã dùng mã này');
    });
  });

  describe('releaseForOrder', () => {
    it('hoàn lượt một lần, gọi lại không trừ thêm', async () => {
      prisma.voucherUsage.findMany.mockResolvedValueOnce([{ id: 'us1', voucherId: 'v1' }]);
      await service.releaseForOrder(prisma, 'o1');
      expect(prisma.voucher.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });

      // Lần 2: lượt đã hoàn (updateMany không đổi dòng nào) -> không trừ usedCount nữa
      prisma.voucher.updateMany.mockClear();
      prisma.voucherUsage.findMany.mockResolvedValueOnce([{ id: 'us1', voucherId: 'v1' }]);
      prisma.voucherUsage.updateMany.mockResolvedValueOnce({ count: 0 });
      await service.releaseForOrder(prisma, 'o1');
      expect(prisma.voucher.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('quản lý', () => {
    const dto = {
      code: 'QUAN15K',
      title: 'Quán giảm 15k',
      discountType: 'FIXED_AMOUNT' as const,
      discountValue: 15_000,
      maxUsage: 50,
      endDate: '2099-01-01T00:00:00Z',
    };

    it('chủ quán tạo mã: gắn quán và quán chịu chi phí, ghi AuditLog', async () => {
      prisma.voucher.findUnique.mockResolvedValue(null);
      await service.create(dto, 'owner-1', { restaurantId: 'r1', fundedBy: 'RESTAURANT' });
      expect(prisma.voucher.create.mock.calls[0][0].data).toMatchObject({ restaurantId: 'r1', fundedBy: 'RESTAURANT' });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('trùng mã -> 409', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow());
      await expect(service.create(dto, 'a', { fundedBy: 'PLATFORM' })).rejects.toThrow(ConflictException);
    });

    it('mã % bắt buộc có mức giảm tối đa', async () => {
      prisma.voucher.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, discountType: 'PERCENTAGE', discountValue: 10 }, 'a', { fundedBy: 'PLATFORM' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('chủ quán không sửa được mã của quán khác', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow({ restaurantId: 'r2', fundedBy: 'RESTAURANT' }));
      await expect(service.update('v1', { title: 'x' }, 'owner-1', { restaurantId: 'r1' })).rejects.toThrow(ForbiddenException);
    });

    it('mã đã có người dùng thì không đổi mức giảm', async () => {
      prisma.voucher.findUnique.mockResolvedValue(voucherRow({ usedCount: 3 }));
      await expect(service.update('v1', { discountValue: 50_000 }, 'a', {})).rejects.toThrow('không đổi mức giảm');
    });
  });

  it('voucher bồi thường: cá nhân, 1 lượt, không cần đơn tối thiểu, sàn chịu', async () => {
    prisma.voucher.findUnique.mockResolvedValue(null);
    const v = await service.createCompensation(prisma, { userId: 'u1', amount: 30_000, actorId: 'admin', ticketCode: 'HT-AB12' });
    expect(v).toMatchObject({
      userId: 'u1',
      discountValue: 30_000,
      maxUsage: 1,
      minOrderAmount: 0,
      fundedBy: 'PLATFORM',
      kind: 'COMPENSATION',
    });
    expect(v.code).toMatch(/^BT[A-Z2-9]{6}$/);
  });
});
