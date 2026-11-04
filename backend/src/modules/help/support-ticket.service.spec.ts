import { Test, TestingModule } from '@nestjs/testing';
import { Role, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { VouchersService } from '../vouchers/vouchers.service';
import { SupportTicketService } from './support-ticket.service';

describe('SupportTicketService', () => {
  let service: SupportTicketService;
  let prisma: any;
  let notifications: any;
  let vouchers: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(5),
      },
      supportTicket: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { csatScore: 4.8 }, _count: { csatScore: 10 } }),
      },
      supportMessage: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    notifications = {
      sendToUsers: jest.fn().mockResolvedValue(undefined),
    };
    vouchers = {
      createCompensation: jest.fn().mockResolvedValue({ id: 'voucher-1', code: 'BTABC234' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: VouchersService, useValue: vouchers },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get<SupportTicketService>(SupportTicketService);
  });

  it('tạo phiếu hỗ trợ không có đơn hàng thành công', async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce(null); // code HT-XXXX chưa tồn tại
    prisma.supportTicket.create.mockResolvedValueOnce({
      id: 'ticket-1',
      code: 'HT-TEST',
      userId: 'user-1',
      status: SupportTicketStatus.NEW,
      priority: SupportTicketPriority.NORMAL,
    });

    const res = await service.createTicket('user-1', {
      category: 'GENERAL_SUPPORT',
      subject: 'Thắc mắc tài khoản',
      description: 'Tôi muốn đổi số điện thoại',
    });

    expect(res.id).toBe('ticket-1');
    expect(prisma.supportMessage.create).toHaveBeenCalled();
  });

  it('chặn khiếu nại đơn hàng của người khác', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'ord-123',
      customerId: 'other-user',
    });

    await expect(
      service.createTicket('user-1', {
        orderId: 'ord-123',
        category: 'ORDER_ISSUE',
        subject: 'Thiếu món',
        description: 'Thiếu trà sữa',
      }),
    ).rejects.toThrow('Bạn chỉ có thể khiếu nại đơn hàng của chính mình');
  });

  it('chặn gửi tin nhắn vào phiếu đã đóng (CLOSED)', async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      id: 'ticket-1',
      userId: 'user-1',
      status: SupportTicketStatus.CLOSED,
    });

    await expect(
      service.addMessage('user-1', Role.CUSTOMER, 'ticket-1', {
        content: 'Alo còn ai không?',
      }),
    ).rejects.toThrow('Phiếu hỗ trợ đã đóng, không thể gửi thêm phản hồi');
  });

  it('admin trả lời thì chuyển trạng thái phiếu sang WAITING_CUSTOMER và gửi thông báo', async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      id: 'ticket-1',
      code: 'HT-TEST',
      userId: 'cust-1',
      status: SupportTicketStatus.NEW,
      firstResponseAt: null,
    });

    prisma.supportMessage.create.mockResolvedValueOnce({ id: 'msg-1', content: 'Dạ chào bạn!' });
    prisma.supportTicket.update.mockResolvedValueOnce({ id: 'ticket-1' });

    await service.addMessage('admin-1', Role.ADMIN, 'ticket-1', {
      content: 'Chào bạn, chúng mình đã liên hệ quán gửi bù món rồi nhé!',
    });

    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SupportTicketStatus.WAITING_CUSTOMER }),
      }),
    );
    expect(notifications.sendToUsers).toHaveBeenCalled();
  });

  it('đánh giá CSAT cập nhật điểm và đóng phiếu (CLOSED)', async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      id: 'ticket-1',
      userId: 'user-1',
      status: SupportTicketStatus.RESOLVED,
    });
    prisma.supportTicket.update.mockResolvedValueOnce({
      id: 'ticket-1',
      csatScore: 5,
      status: SupportTicketStatus.CLOSED,
    });

    const res = await service.submitCsat('user-1', 'ticket-1', {
      csatScore: 5,
      csatComment: 'Hỗ trợ rất nhanh và chu đáo!',
    });

    expect(res.status).toBe(SupportTicketStatus.CLOSED);
  });

  it('thiếu món trong hạn mức, khách uy tín: phát voucher cá nhân thật và báo mã cho khách', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'ord-1',
      customerId: 'user-1',
      status: 'DELIVERED',
      total: 120_000,
      paymentMethod: 'COD',
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedDeliveryAt: null,
      items: [],
      restaurant: { id: 'r1', name: 'Quán', imageUrl: null },
    });
    prisma.supportTicket.findUnique.mockResolvedValueOnce(null);
    prisma.supportTicket.create.mockImplementationOnce(({ data }: any) => Promise.resolve({ id: 't1', ...data }));

    const res: any = await service.createTicket('user-1', {
      orderId: 'ord-1',
      category: 'ORDER_ISSUE',
      subject: 'Thiếu món',
      description: 'Thiếu trà đá',
      issueType: 'MISSING_ITEMS',
      affectedItems: [{ name: 'Trà đá', quantity: 1, price: 10_000 }],
    });

    expect(vouchers.createCompensation).toHaveBeenCalledWith(prisma, expect.objectContaining({ userId: 'user-1', amount: 10_000 }));
    expect(res.status).toBe(SupportTicketStatus.RESOLVED);
    expect(res.resolution.voucherCode).toBe('BTABC234');
    const systemMsg = prisma.supportMessage.create.mock.calls.find((c: any) => c[0].data.senderRole === 'SYSTEM');
    expect(systemMsg[0].data.content).toContain('BTABC234');
  });

  it('admin bồi thường: phát voucher, phiếu Đã giải quyết; bồi thường lần 2 bị chặn', async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      id: 't1',
      code: 'HT-AB12',
      userId: 'user-1',
      status: SupportTicketStatus.NEW,
      resolution: { decision: 'NEEDS_REVIEW' },
    });
    prisma.supportTicket.update.mockResolvedValueOnce({ id: 't1', status: SupportTicketStatus.RESOLVED });

    await service.adminCompensate('t1', 'admin-1', { amount: 30_000 });
    expect(vouchers.createCompensation).toHaveBeenCalledWith(prisma, expect.objectContaining({ amount: 30_000, actorId: 'admin-1' }));
    expect(prisma.supportTicket.update.mock.calls[0][0].data.status).toBe(SupportTicketStatus.RESOLVED);
    expect(notifications.sendToUsers).toHaveBeenCalled();

    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      id: 't1',
      code: 'HT-AB12',
      userId: 'user-1',
      resolution: { voucherCode: 'BTABC234' },
    });
    await expect(service.adminCompensate('t1', 'admin-1', { amount: 30_000 })).rejects.toThrow('đã được bồi thường');
  });
});
