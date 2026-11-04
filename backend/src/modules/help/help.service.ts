import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { HelpAudience, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ArticleFeedbackDto,
  CreateHelpArticleDto,
  CreateHelpCategoryDto,
  ListHelpArticlesQueryDto,
  ListHelpCategoriesQueryDto,
  UpdateHelpArticleDto,
  UpdateHelpCategoryDto,
} from './dto/help.dto';
import { rankHelpArticles } from './help-ranking.util';
import { SEED_HELP_ARTICLES, SEED_HELP_CATEGORIES } from './help-seed.data';

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultFaqIfNeeded();
  }

  /**
   * Tự động khởi tạo danh mục và bài viết trợ giúp mẫu nếu CSDL chưa có dữ liệu.
   */
  async seedDefaultFaqIfNeeded(): Promise<void> {
    try {
      const count = await this.prisma.helpCategory.count();
      if (count > 0) return;

      this.logger.log('Khởi tạo danh mục & bài viết trợ giúp FAQ mặc định...');

      const catMap = new Map<string, string>();

      for (const cat of SEED_HELP_CATEGORIES) {
        const created = await this.prisma.helpCategory.create({
          data: {
            code: cat.code,
            name: cat.name,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
            audience: cat.audience,
            isActive: true,
          },
        });
        catMap.set(cat.code, created.id);
      }

      for (const art of SEED_HELP_ARTICLES) {
        const categoryId = catMap.get(art.categoryCode);
        if (!categoryId) continue;

        await this.prisma.helpArticle.create({
          data: {
            categoryId,
            title: art.title,
            body: art.body,
            keywords: art.keywords,
            sortOrder: art.sortOrder,
            isActive: true,
          },
        });
      }

      this.logger.log(`Đã nạp ${SEED_HELP_CATEGORIES.length} danh mục và ${SEED_HELP_ARTICLES.length} bài viết trợ giúp thành công.`);
    } catch (err) {
      this.logger.warn(`Seed FAQ mặc định thất bại: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // =========================================================================
  //  DÀNH CHO KHÁCH HÀNG (CUSTOMER APIs)
  // =========================================================================

  /** Lấy danh sách danh mục FAQ đang hoạt động */
  async getCategories(query: ListHelpCategoriesQueryDto) {
    const audience = query.audience ?? HelpAudience.CUSTOMER;
    return this.prisma.helpCategory.findMany({
      where: {
        audience,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            articles: {
              where: { isActive: true },
            },
          },
        },
      },
    });
  }

  /** Lấy danh sách bài viết / tìm kiếm bài viết */
  async getArticles(query: ListHelpArticlesQueryDto) {
    const where: Prisma.HelpArticleWhereInput = {
      isActive: true,
      category: { isActive: true },
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const allArticles = await this.prisma.helpArticle.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true, icon: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { viewCount: 'desc' }],
    });

    if (query.q && query.q.trim()) {
      return rankHelpArticles(allArticles, query.q, 10);
    }

    return allArticles;
  }

  /** Lấy 5 bài viết được xem nhiều nhất (Câu hỏi phổ biến) */
  async getPopularArticles(limit: number = 5) {
    return this.prisma.helpArticle.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      include: {
        category: {
          select: { id: true, code: true, name: true, icon: true },
        },
      },
    });
  }

  /** Lấy chi tiết bài viết và tăng lượt xem viewCount */
  async getArticleById(id: string, userId?: string) {
    const article = await this.prisma.helpArticle.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, code: true, name: true, icon: true },
        },
      },
    });

    if (!article || !article.isActive) {
      throw new NotFoundException('Bài viết trợ giúp không tồn tại hoặc đã bị ẩn.');
    }

    // Tăng lượt xem (không chặn luồng)
    void this.prisma.helpArticle
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);

    let userFeedback: boolean | null = null;
    if (userId) {
      const fb = await this.prisma.helpArticleFeedback.findUnique({
        where: {
          articleId_userId: {
            articleId: id,
            userId,
          },
        },
        select: { helpful: true },
      });
      userFeedback = fb ? fb.helpful : null;
    }

    return {
      ...article,
      userFeedback,
    };
  }

  /** Gửi phản hồi hữu ích (👍 / 👎) - mỗi người 1 lần */
  async recordFeedback(articleId: string, userId: string, dto: ArticleFeedbackDto) {
    const article = await this.prisma.helpArticle.findUnique({
      where: { id: articleId },
      select: { id: true, helpfulCount: true, notHelpfulCount: true },
    });

    if (!article) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    const existing = await this.prisma.helpArticleFeedback.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId,
        },
      },
    });

    if (existing) {
      if (existing.helpful === dto.helpful) {
        // Đã vote cùng lựa chọn trước đó
        return { success: true, message: 'Đã ghi nhận đánh giá của bạn.' };
      }

      // Đổi vote: cập nhật lại count
      await this.prisma.$transaction([
        this.prisma.helpArticleFeedback.update({
          where: { id: existing.id },
          data: { helpful: dto.helpful },
        }),
        this.prisma.helpArticle.update({
          where: { id: articleId },
          data: {
            helpfulCount: { [dto.helpful ? 'increment' : 'decrement']: 1 },
            notHelpfulCount: { [dto.helpful ? 'decrement' : 'increment']: 1 },
          },
        }),
      ]);
      return { success: true, message: 'Đã cập nhật đánh giá của bạn.' };
    }

    // Vote mới
    await this.prisma.$transaction([
      this.prisma.helpArticleFeedback.create({
        data: {
          articleId,
          userId,
          helpful: dto.helpful,
        },
      }),
      this.prisma.helpArticle.update({
        where: { id: articleId },
        data: {
          [dto.helpful ? 'helpfulCount' : 'notHelpfulCount']: { increment: 1 },
        },
      }),
    ]);

    return { success: true, message: 'Cảm ơn bạn đã phản hồi bài viết.' };
  }

  // =========================================================================
  //  DÀNH CHO QUẢN TRỊ VIÊN (ADMIN CRUD)
  // =========================================================================

  async adminListCategories() {
    return this.prisma.helpCategory.findMany({
      orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async adminCreateCategory(dto: CreateHelpCategoryDto, adminId: string) {
    const existing = await this.prisma.helpCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Mã danh mục "${dto.code}" đã tồn tại.`);
    }

    const category = await this.prisma.helpCategory.create({
      data: dto,
    });

    await this.logAudit(adminId, 'HELP_CATEGORY_CREATE', 'HelpCategory', category.id, {
      code: category.code,
      name: category.name,
    });

    return category;
  }

  async adminUpdateCategory(id: string, dto: UpdateHelpCategoryDto, adminId: string) {
    const category = await this.prisma.helpCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại.');

    if (dto.code && dto.code !== category.code) {
      const duplicate = await this.prisma.helpCategory.findUnique({ where: { code: dto.code } });
      if (duplicate) throw new ConflictException(`Mã danh mục "${dto.code}" đã được sử dụng.`);
    }

    const updated = await this.prisma.helpCategory.update({
      where: { id },
      data: dto,
    });

    await this.logAudit(adminId, 'HELP_CATEGORY_UPDATE', 'HelpCategory', id, dto);
    return updated;
  }

  async adminDeleteCategory(id: string, adminId: string) {
    const category = await this.prisma.helpCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại.');

    await this.prisma.helpCategory.delete({ where: { id } });
    await this.logAudit(adminId, 'HELP_CATEGORY_DELETE', 'HelpCategory', id, { code: category.code });
    return { success: true };
  }

  async adminListArticles(categoryId?: string) {
    return this.prisma.helpArticle.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: {
          select: { id: true, code: true, name: true, audience: true },
        },
      },
    });
  }

  async adminCreateArticle(dto: CreateHelpArticleDto, adminId: string) {
    const category = await this.prisma.helpCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException('Danh mục bài viết không hợp lệ.');
    }

    const article = await this.prisma.helpArticle.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        body: dto.body,
        keywords: dto.keywords || [],
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });

    await this.logAudit(adminId, 'HELP_ARTICLE_CREATE', 'HelpArticle', article.id, {
      title: article.title,
      categoryId: article.categoryId,
    });

    return article;
  }

  async adminUpdateArticle(id: string, dto: UpdateHelpArticleDto, adminId: string) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Bài viết không tồn tại.');

    if (dto.categoryId && dto.categoryId !== article.categoryId) {
      const category = await this.prisma.helpCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new BadRequestException('Danh mục mới không hợp lệ.');
    }

    const updated = await this.prisma.helpArticle.update({
      where: { id },
      data: dto,
      include: { category: true },
    });

    await this.logAudit(adminId, 'HELP_ARTICLE_UPDATE', 'HelpArticle', id, dto);
    return updated;
  }

  async adminDeleteArticle(id: string, adminId: string) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Bài viết không tồn tại.');

    await this.prisma.helpArticle.delete({ where: { id } });
    await this.logAudit(adminId, 'HELP_ARTICLE_DELETE', 'HelpArticle', id, { title: article.title });
    return { success: true };
  }

  private async logAudit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action,
          targetType,
          targetId,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch (err) {
      this.logger.warn(`Lỗi ghi AuditLog: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

