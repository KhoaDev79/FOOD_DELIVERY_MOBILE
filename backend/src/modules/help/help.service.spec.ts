import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HelpAudience } from '@prisma/client';
import { HelpService } from './help.service';

describe('HelpService', () => {
  let service: HelpService;
  let prisma: {
    helpCategory: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    helpArticle: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    helpArticleFeedback: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      helpCategory: {
        count: jest.fn().mockResolvedValue(4),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      helpArticle: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
      },
      helpArticleFeedback: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    service = new HelpService(prisma as any);
  });

  describe('getCategories', () => {
    it('lấy danh sách danh mục đang hoạt động với audience CUSTOMER', async () => {
      const mockCats = [
        { id: 'cat-1', code: 'order_delivery', name: 'Đơn hàng', sortOrder: 1, isActive: true },
      ];
      prisma.helpCategory.findMany.mockResolvedValue(mockCats);

      const result = await service.getCategories({ audience: HelpAudience.CUSTOMER });

      expect(prisma.helpCategory.findMany).toHaveBeenCalledWith({
        where: { audience: HelpAudience.CUSTOMER, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { articles: { where: { isActive: true } } } } },
      });
      expect(result).toEqual(mockCats);
    });
  });

  describe('getArticles', () => {
    it('lấy danh sách bài viết theo danh mục', async () => {
      const mockArticles = [
        { id: 'art-1', title: 'Phí ship', body: 'Nội dung', keywords: ['ship'], sortOrder: 1, viewCount: 10 },
      ];
      prisma.helpArticle.findMany.mockResolvedValue(mockArticles);

      const result = await service.getArticles({ categoryId: 'cat-1' });

      expect(prisma.helpArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1', isActive: true }),
        }),
      );
      expect(result).toEqual(mockArticles);
    });

    it('tìm kiếm và xếp hạng bài viết khi có tham số q', async () => {
      const mockArticles = [
        { id: 'art-1', title: 'Cách tính phí ship', body: 'Nội dung phí', keywords: ['ship'], sortOrder: 1, helpfulCount: 0, notHelpfulCount: 0, viewCount: 10 },
        { id: 'art-2', title: 'Đổi địa chỉ', body: 'Nội dung địa chỉ', keywords: ['địa chỉ'], sortOrder: 2, helpfulCount: 0, notHelpfulCount: 0, viewCount: 5 },
      ];
      prisma.helpArticle.findMany.mockResolvedValue(mockArticles);

      const result = await service.getArticles({ q: 'phi ship' });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('art-1');
    });
  });

  describe('getArticleById', () => {
    it('trả về chi tiết bài viết và tăng viewCount', async () => {
      const mockArticle = {
        id: 'art-1',
        title: 'Phí ship',
        body: 'Nội dung',
        isActive: true,
        category: { id: 'cat-1', name: 'Đơn hàng' },
      };
      prisma.helpArticle.findUnique.mockResolvedValue(mockArticle);

      const result = await service.getArticleById('art-1', 'user-1');

      expect(result.title).toBe('Phí ship');
      expect(prisma.helpArticle.update).toHaveBeenCalledWith({
        where: { id: 'art-1' },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('ném lỗi NotFoundException nếu bài viết không tồn tại hoặc bị ẩn', async () => {
      prisma.helpArticle.findUnique.mockResolvedValue(null);

      await expect(service.getArticleById('art-none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordFeedback', () => {
    it('ghi nhận đánh giá hữu ích của người dùng', async () => {
      prisma.helpArticle.findUnique.mockResolvedValue({ id: 'art-1', helpfulCount: 5, notHelpfulCount: 0 });
      prisma.helpArticleFeedback.findUnique.mockResolvedValue(null);

      const result = await service.recordFeedback('art-1', 'user-1', { helpful: true });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('adminCreateCategory', () => {
    it('tạo danh mục mới và ghi AuditLog', async () => {
      prisma.helpCategory.findUnique.mockResolvedValue(null);
      prisma.helpCategory.create.mockResolvedValue({
        id: 'cat-new',
        code: 'account_help',
        name: 'Hỗ trợ tài khoản',
      });

      const result = await service.adminCreateCategory(
        { code: 'account_help', name: 'Hỗ trợ tài khoản' },
        'admin-1',
      );

      expect(result.id).toBe('cat-new');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('ném lỗi ConflictException nếu mã danh mục đã tồn tại', async () => {
      prisma.helpCategory.findUnique.mockResolvedValue({ id: 'cat-old', code: 'account_help' });

      await expect(
        service.adminCreateCategory({ code: 'account_help', name: 'Hỗ trợ' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('adminCreateArticle', () => {
    it('tạo bài viết mới khi danh mục hợp lệ', async () => {
      prisma.helpCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.helpArticle.create.mockResolvedValue({
        id: 'art-new',
        categoryId: 'cat-1',
        title: 'Mẹo đặt món nhanh',
      });

      const result = await service.adminCreateArticle(
        { categoryId: 'cat-1', title: 'Mẹo đặt món nhanh', body: 'Chi tiết...' },
        'admin-1',
      );

      expect(result.id).toBe('art-new');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('ném lỗi BadRequestException nếu danh mục không tồn tại', async () => {
      prisma.helpCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.adminCreateArticle(
          { categoryId: 'cat-fake', title: 'Tiêu đề', body: 'Nội dung' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

