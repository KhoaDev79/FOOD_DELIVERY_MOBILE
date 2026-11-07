import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (Coalescing & Read-Sync cho order_chat)', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let gateway: { emitNotification: jest.Mock };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'notif-new', createdAt: new Date(), readAt: null, ...data }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, readAt: null, ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    gateway = { emitNotification: jest.fn() };
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    service = new NotificationsService(prisma as never, config, gateway as never);
  });

  it('tạo thông báo order_chat mới với unreadCount = 1 khi chưa có thông báo chưa đọc cùng hội thoại', async () => {
    await service.sendToUsers(['cust-1'], {
      title: 'Tin nhắn mới từ Quán Ngon',
      body: 'Món của bạn đang được làm nhé',
      data: {
        type: 'order_chat',
        orderId: 'ord-1',
        channel: 'CUSTOMER_RESTAURANT',
        recipientName: 'Quán Ngon',
        recipientRole: 'Quán ăn',
      },
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'cust-1',
          type: 'order_chat',
          title: 'Tin nhắn mới từ Quán Ngon',
          body: 'Món của bạn đang được làm nhé',
          data: expect.objectContaining({
            type: 'order_chat',
            orderId: 'ord-1',
            channel: 'CUSTOMER_RESTAURANT',
            recipientName: 'Quán Ngon',
            recipientRole: 'Quán ăn',
            unreadCount: 1,
          }),
        }),
      }),
    );
    expect(gateway.emitNotification).toHaveBeenCalledTimes(1);
  });

  it('gộp (coalesce) vào thông báo order_chat chưa đọc của cùng (orderId, channel) và tăng unreadCount', async () => {
    prisma.notification.findMany.mockResolvedValueOnce([
      {
        id: 'notif-existing',
        userId: 'cust-1',
        type: 'order_chat',
        readAt: null,
        data: {
          type: 'order_chat',
          orderId: 'ord-1',
          channel: 'CUSTOMER_RESTAURANT',
          recipientName: 'Quán Ngon',
          recipientRole: 'Quán ăn',
          unreadCount: 2,
        },
      },
    ]);

    await service.sendToUsers(['cust-1'], {
      title: 'Tin nhắn mới từ Quán Ngon',
      body: 'Món xong rồi bạn nhé!',
      data: {
        type: 'order_chat',
        orderId: 'ord-1',
        channel: 'CUSTOMER_RESTAURANT',
        recipientName: 'Quán Ngon',
        recipientRole: 'Quán ăn',
      },
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-existing' },
        data: expect.objectContaining({
          title: 'Tin nhắn mới từ Quán Ngon',
          body: 'Món xong rồi bạn nhé!',
          data: expect.objectContaining({
            orderId: 'ord-1',
            channel: 'CUSTOMER_RESTAURANT',
            unreadCount: 3,
          }),
        }),
      }),
    );
    expect(gateway.emitNotification).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ id: 'notif-existing' }),
    );
  });

  it('markOrderChatNotificationsAsRead: chỉ đánh dấu đã đọc các thông báo khớp đúng orderId và channel', async () => {
    prisma.notification.findMany.mockResolvedValueOnce([
      {
        id: 'notif-chat-1',
        data: { type: 'order_chat', orderId: 'ord-1', channel: 'CUSTOMER_DRIVER' },
      },
      {
        id: 'notif-chat-2',
        data: { type: 'order_chat', orderId: 'ord-1', channel: 'CUSTOMER_RESTAURANT' },
      },
    ]);

    const count = await service.markOrderChatNotificationsAsRead('cust-1', 'ord-1', 'CUSTOMER_DRIVER');
    expect(count).toBe(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['notif-chat-1'] }, userId: 'cust-1', readAt: null },
      }),
    );
  });

  it('notifyReviewReplied: đính kèm restaurantId và restaurantName để điều hướng mở đúng trang đánh giá quán', async () => {
    await service.notifyReviewReplied({
      id: 'rev-1',
      orderId: 'ord-1',
      customerId: 'cust-1',
      restaurantId: 'rest-99',
      restaurantName: 'Bún Bò Huế O Xuân',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'review_reply',
          data: {
            type: 'review_reply',
            reviewId: 'rev-1',
            orderId: 'ord-1',
            restaurantId: 'rest-99',
            restaurantName: 'Bún Bò Huế O Xuân',
          },
        }),
      }),
    );
  });
});
