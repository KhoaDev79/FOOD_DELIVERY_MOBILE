import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertSchedule,
  bannerStatus,
  normalizeBannerAction,
  normalizeKeywords,
  slugifyCode,
} from './content-rules';
import { CreateBannerDto, CreateCuisineDto, UpdateBannerDto, UpdateCuisineDto } from './dto/content.dto';

const toDate = (v?: string | null) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** Quản lý nội dung trang chủ (banner, danh mục ẩm thực) cho quản trị viên. Mọi thay đổi ghi nhật ký. */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  private audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, targetType, targetId, metadata } });
  }

  // ---------------- Banner ----------------

  async listBanners() {
    const rows = await this.prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    const now = new Date();
    return rows.map((b) => ({ ...b, ...normalizeBannerAction(b.actionType, b.actionValue), status: bannerStatus(b, now) }));
  }

  private async assertActionTarget(actionType: string, actionValue: string | null) {
    if (actionType === 'RESTAURANT' && actionValue) {
      const r = await this.prisma.restaurant.findUnique({ where: { id: actionValue }, select: { id: true } }).catch(() => null);
      if (!r) throw new BadRequestException('Quán được chọn cho banner không tồn tại');
    }
    if (actionType === 'CUISINE' && actionValue) {
      const c = await this.prisma.cuisineCategory.findUnique({ where: { code: actionValue }, select: { id: true } });
      if (!c) throw new BadRequestException('Danh mục được chọn cho banner không tồn tại');
    }
  }

  async createBanner(actorId: string, dto: CreateBannerDto) {
    const startAt = toDate(dto.startAt) ?? null;
    const endAt = toDate(dto.endAt) ?? null;
    assertSchedule(startAt, endAt);
    const action = normalizeBannerAction(dto.actionType ?? 'NONE', dto.actionValue);
    await this.assertActionTarget(action.actionType, action.actionValue);
    const last = await this.prisma.banner.aggregate({ _max: { sortOrder: true } });
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        imageUrl: (await this.media.resolveImage(dto.imageUrl, 'banners')) ?? dto.imageUrl.trim(),
        ...action,
        isActive: dto.isActive ?? true,
        startAt,
        endAt,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    await this.audit(actorId, 'BANNER_CREATE', 'BANNER', banner.id, { title: banner.title });
    return banner;
  }

  async updateBanner(actorId: string, id: string, dto: UpdateBannerDto) {
    const current = await this.prisma.banner.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy banner');
    const startAt = dto.startAt === undefined ? current.startAt : toDate(dto.startAt);
    const endAt = dto.endAt === undefined ? current.endAt : toDate(dto.endAt);
    assertSchedule(startAt, endAt);
    const actionChanged = dto.actionType !== undefined || dto.actionValue !== undefined;
    const action = actionChanged
      ? normalizeBannerAction(dto.actionType ?? current.actionType, dto.actionValue !== undefined ? dto.actionValue : current.actionValue)
      : null;
    if (action) await this.assertActionTarget(action.actionType, action.actionValue);

    const resolvedImageUrl =
      dto.imageUrl !== undefined ? (await this.media.resolveImage(dto.imageUrl, 'banners')) ?? '' : undefined;

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(resolvedImageUrl !== undefined ? { imageUrl: resolvedImageUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(action ?? {}),
        startAt,
        endAt,
      },
    });
    await this.audit(actorId, 'BANNER_UPDATE', 'BANNER', id, { changes: Object.keys(dto) });
    return banner;
  }

  async deleteBanner(actorId: string, id: string) {
    const current = await this.prisma.banner.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy banner');
    await this.prisma.banner.delete({ where: { id } });
    await this.audit(actorId, 'BANNER_DELETE', 'BANNER', id, { title: current.title });
    return { deleted: true };
  }

  async reorderBanners(actorId: string, ids: string[]) {
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.banner.updateMany({ where: { id }, data: { sortOrder: i + 1 } })));
    await this.audit(actorId, 'BANNER_REORDER', 'BANNER', 'all', { ids });
    return this.listBanners();
  }

  // ---------------- Danh mục ẩm thực ----------------

  listCuisines() {
    return this.prisma.cuisineCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  /** Mã danh mục duy nhất từ tên: "che-do-ngot", trùng thì thêm -2, -3… */
  private async uniqueCode(name: string) {
    const base = slugifyCode(name);
    const taken = new Set(
      (await this.prisma.cuisineCategory.findMany({ where: { code: { startsWith: base } }, select: { code: true } })).map((c) => c.code),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }

  async createCuisine(actorId: string, dto: CreateCuisineDto) {
    const name = dto.name.trim();
    const keywords = normalizeKeywords(dto.keywords?.length ? dto.keywords : [name]);
    const last = await this.prisma.cuisineCategory.aggregate({ _max: { sortOrder: true } });
    const cuisine = await this.prisma.cuisineCategory.create({
      data: {
        code: await this.uniqueCode(name),
        name,
        imageUrl: (await this.media.resolveImage(dto.imageUrl, 'cuisines')) ?? dto.imageUrl.trim(),
        keywords,
        isActive: dto.isActive ?? true,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    await this.audit(actorId, 'CUISINE_CREATE', 'CUISINE', cuisine.id, { name });
    return cuisine;
  }

  async updateCuisine(actorId: string, id: string, dto: UpdateCuisineDto) {
    const current = await this.prisma.cuisineCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy danh mục');
    // Giữ nguyên mã (code) khi đổi tên: banner đang trỏ tới danh mục này không bị hỏng
    const resolvedImageUrl =
      dto.imageUrl !== undefined ? (await this.media.resolveImage(dto.imageUrl, 'cuisines')) ?? '' : undefined;

    const cuisine = await this.prisma.cuisineCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(resolvedImageUrl !== undefined ? { imageUrl: resolvedImageUrl } : {}),
        ...(dto.keywords !== undefined ? { keywords: normalizeKeywords(dto.keywords) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit(actorId, 'CUISINE_UPDATE', 'CUISINE', id, { changes: Object.keys(dto) });
    return cuisine;
  }

  async deleteCuisine(actorId: string, id: string) {
    const current = await this.prisma.cuisineCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy danh mục');
    const usedBy = await this.prisma.banner.count({ where: { actionType: 'CUISINE', actionValue: current.code } });
    if (usedBy > 0) {
      throw new BadRequestException(`Danh mục đang được ${usedBy} banner sử dụng. Hãy đổi banner trước, hoặc tắt danh mục thay vì xoá.`);
    }
    await this.prisma.cuisineCategory.delete({ where: { id } });
    await this.audit(actorId, 'CUISINE_DELETE', 'CUISINE', id, { name: current.name });
    return { deleted: true };
  }

  async reorderCuisines(actorId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.cuisineCategory.updateMany({ where: { id }, data: { sortOrder: i + 1 } })),
    );
    await this.audit(actorId, 'CUISINE_REORDER', 'CUISINE', 'all', { ids });
    return this.listCuisines();
  }
}
