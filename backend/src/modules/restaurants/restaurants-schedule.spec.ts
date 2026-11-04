import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantsService } from './restaurants.service';

describe('RestaurantsService - Schedule & Special Closings', () => {
  let service: RestaurantsService;
  let prisma: {
    restaurant: { findUnique: jest.Mock };
    restaurantOpeningHour: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    restaurantSpecialClosing: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockOwner: AuthUser = { id: 'owner-1', email: 'owner@test.com', role: 'RESTAURANT_OWNER' };
  const otherUser: AuthUser = { id: 'user-2', email: 'other@test.com', role: 'RESTAURANT_OWNER' };

  beforeEach(async () => {
    prisma = {
      restaurant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'res-1',
          name: 'Quán Phở Thìn',
          ownerId: 'owner-1',
          openTime: '06:00',
          closeTime: '22:00',
        }),
      },
      restaurantOpeningHour: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 7 }),
      },
      restaurantSpecialClosing: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'close-1', ...create })),
        delete: jest.fn().mockResolvedValue({ id: 'close-1' }),
      },
      $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
        { provide: MediaService, useValue: { resolveImage: jest.fn() } },
      ],
    }).compile();

    service = module.get<RestaurantsService>(RestaurantsService);
  });

  describe('getSchedule', () => {
    it('lấy thành công lịch 7 ngày và danh sách ngày nghỉ đặc biệt', async () => {
      prisma.restaurantOpeningHour.findMany.mockResolvedValue([
        { id: 'h-1', dayOfWeek: 1, openTime: '07:00', closeTime: '21:00', isClosed: false },
      ]);
      prisma.restaurantSpecialClosing.findMany.mockResolvedValue([
        { id: 'sc-1', date: new Date('2026-11-20'), reason: 'Sửa quán' },
      ]);

      const res = await service.getSchedule('res-1');

      expect(res.defaultOpenTime).toBe('06:00');
      expect(res.defaultCloseTime).toBe('22:00');
      expect(res.openingHours).toHaveLength(1);
      expect(res.specialClosings).toHaveLength(1);
    });

    it('ném lỗi NotFoundException nếu quán không tồn tại', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(null);
      await expect(service.getSchedule('res-404')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateWeeklySchedule', () => {
    it('áp dụng cấu hình ngày đầu tiên cho cả 7 ngày khi applyToAllDays = true', async () => {
      await service.updateWeeklySchedule('res-1', mockOwner, {
        schedule: [{ dayOfWeek: 1, openTime: '08:00', closeTime: '23:00', isClosed: false }],
        applyToAllDays: true,
      });

      expect(prisma.restaurantOpeningHour.deleteMany).toHaveBeenCalledWith({ where: { restaurantId: 'res-1' } });
      expect(prisma.restaurantOpeningHour.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ dayOfWeek: 0, openTime: '08:00', closeTime: '23:00' }),
          expect.objectContaining({ dayOfWeek: 1, openTime: '08:00', closeTime: '23:00' }),
          expect.objectContaining({ dayOfWeek: 6, openTime: '08:00', closeTime: '23:00' }),
        ]),
      });
    });

    it('chặn người dùng khác không phải chủ quán', async () => {
      await expect(
        service.updateWeeklySchedule('res-1', otherUser, {
          schedule: [{ dayOfWeek: 1, openTime: '08:00', closeTime: '23:00' }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addSpecialClosing', () => {
    it('lưu thành công ngày nghỉ đặc biệt', async () => {
      const res = await service.addSpecialClosing('res-1', mockOwner, {
        date: '2026-12-25',
        reason: 'Nghỉ Giáng Sinh',
      });

      expect(res).toBeDefined();
      expect(prisma.restaurantSpecialClosing.upsert).toHaveBeenCalledWith({
        where: {
          restaurantId_date: {
            restaurantId: 'res-1',
            date: expect.any(Date),
          },
        },
        create: expect.objectContaining({
          restaurantId: 'res-1',
          reason: 'Nghỉ Giáng Sinh',
        }),
        update: expect.objectContaining({
          reason: 'Nghỉ Giáng Sinh',
        }),
      });
    });
  });

  describe('removeSpecialClosing', () => {
    it('xoá thành công ngày nghỉ đặc biệt nếu tồn tại', async () => {
      prisma.restaurantSpecialClosing.findFirst.mockResolvedValue({ id: 'sc-1', restaurantId: 'res-1' });

      const res = await service.removeSpecialClosing('res-1', mockOwner, 'sc-1');

      expect(res).toEqual({ success: true });
      expect(prisma.restaurantSpecialClosing.delete).toHaveBeenCalledWith({ where: { id: 'sc-1' } });
    });

    it('ném lỗi NotFoundException nếu không tìm thấy ngày nghỉ', async () => {
      prisma.restaurantSpecialClosing.findFirst.mockResolvedValue(null);

      await expect(service.removeSpecialClosing('res-1', mockOwner, 'sc-404')).rejects.toThrow(NotFoundException);
    });
  });
});

