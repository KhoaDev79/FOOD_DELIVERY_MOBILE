import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    user: { findMany: jest.Mock; updateMany: jest.Mock };
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let gateway: { emitNotification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      notification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'n-1', ...data, createdAt: new Date(), readAt: null })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'n-1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue({ id: 'n-1' }),
      },
    };

    gateway = {
      emitNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
        { provide: OrdersGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('sendToUsers', () => {
    it('lưu bản ghi vào database và phát socket cho từng user', async () => {
      await service.sendToUsers(['user-1', 'user-2'], {
        title: 'Đơn hàng mới',
        body: 'Bạn có đơn hàng mới',
        data: { type: 'order', orderId: 'ord-123' },
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'order',
          title: 'Đơn hàng mới',
          body: 'Bạn có đơn hàng mới',
        }),
      });
      expect(gateway.emitNotification).toHaveBeenCalledTimes(2);
      expect(gateway.emitNotification).toHaveBeenCalledWith('user-1', expect.objectContaining({ userId: 'user-1' }));
    });

    it('bỏ qua nếu danh sách user rỗng', async () => {
      await service.sendToUsers([], {
        title: 'Thử nghiệm',
        body: 'Nội dung',
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(gateway.emitNotification).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('trả về danh sách phân trang và đếm chưa đọc', async () => {
      const mockItems = [
        { id: 'n-1', userId: 'u-1', title: 'Thông báo 1', readAt: null },
      ];
      prisma.notification.findMany.mockResolvedValue(mockItems);
      prisma.notification.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(2); // unreadCount

      const result = await service.list('u-1', { page: 1, limit: 10 });

      expect(result).toEqual({
        items: mockItems,
        total: 5,
        unreadCount: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasMore: true,
      });
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('đếm đúng số lượng thông báo readAt = null', async () => {
      prisma.notification.count.mockResolvedValue(3);
      const res = await service.getUnreadCount('u-1');
      expect(res).toEqual({ unreadCount: 3 });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'u-1', readAt: null },
      });
    });
  });

  describe('markAsRead', () => {
    it('cập nhật readAt khi thông báo chưa đọc', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'n-1',
        userId: 'u-1',
        readAt: null,
      });

      await service.markAsRead('u-1', 'n-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('không gọi update nếu đã đọc trước đó', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'n-1',
        userId: 'u-1',
        readAt: new Date(),
      });

      await service.markAsRead('u-1', 'n-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('ném lỗi NotFoundException nếu thông báo không tồn tại', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('u-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('đánh dấu tất cả thông báo chưa đọc của user là đã đọc', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const res = await service.markAllAsRead('u-1');

      expect(res).toEqual({ count: 4 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('delete', () => {
    it('xoá thông báo nếu tồn tại', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n-1', userId: 'u-1' });

      const res = await service.delete('u-1', 'n-1');

      expect(res).toEqual({ success: true });
      expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n-1' } });
    });

    it('ném lỗi NotFoundException nếu thông báo không tồn tại', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.delete('u-1', 'n-404')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cleanOldNotifications', () => {
    it('xoá thông báo có createdAt nhỏ hơn ngưỡng ngày', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 12 });

      const count = await service.cleanOldNotifications(90);

      expect(count).toBe(12);
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
