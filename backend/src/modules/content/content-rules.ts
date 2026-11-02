import { BadRequestException } from '@nestjs/common';
import { foldVietnamese } from '../../common/utils/vietnamese';

/** Bấm vào banner thì đi đâu. Giá trị cũ không nằm trong danh sách (vd COLLECTION) coi như NONE. */
export const BANNER_ACTIONS = ['NONE', 'RESTAURANT', 'CUISINE', 'SEARCH'] as const;
export type BannerAction = (typeof BANNER_ACTIONS)[number];

export function normalizeBannerAction(type?: string | null, value?: string | null): { actionType: BannerAction; actionValue: string | null } {
  const t = (BANNER_ACTIONS as readonly string[]).includes(type ?? '') ? (type as BannerAction) : 'NONE';
  const v = value?.trim() || null;
  // Hành động cần đích đến mà thiếu đích đến thì không bấm được
  if (t === 'NONE' || !v) return { actionType: 'NONE', actionValue: null };
  return { actionType: t, actionValue: v };
}

export type BannerStatus = 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'OFF';

/** Trạng thái hiển thị của banner theo công tắc và lịch chạy. */
export function bannerStatus(
  b: { isActive: boolean; startAt?: Date | null; endAt?: Date | null },
  now: Date = new Date(),
): BannerStatus {
  if (!b.isActive) return 'OFF';
  if (b.startAt && b.startAt.getTime() > now.getTime()) return 'SCHEDULED';
  if (b.endAt && b.endAt.getTime() < now.getTime()) return 'EXPIRED';
  return 'LIVE';
}

/** Điều kiện Prisma: banner đang bật và đang trong lịch chạy (dùng cho trang chủ). */
export function liveBannerWhere(now: Date = new Date()) {
  return {
    isActive: true,
    AND: [
      { OR: [{ startAt: null }, { startAt: { lte: now } }] },
      { OR: [{ endAt: null }, { endAt: { gte: now } }] },
    ],
  };
}

export function assertSchedule(startAt?: Date | null, endAt?: Date | null) {
  if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
    throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
  }
}

/** "Chè - Đồ ngọt" -> "che-do-ngot" (mã danh mục, dùng làm liên kết ổn định). */
export function slugifyCode(name: string): string {
  return (
    foldVietnamese(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'danh-muc'
  );
}

/** Chuẩn hoá từ khoá tìm kiếm: bỏ trống, bỏ trùng (không phân biệt hoa thường), tối đa 15. */
export function normalizeKeywords(list: string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of list ?? []) {
    const k = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (k && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 15);
}

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Kiểm tra ảnh gửi lên dạng data URI: chỉ JPG/PNG/WebP, tối đa 5 MB. */
export function parseImageDataUri(dataUri: string): { mime: string; buffer: Buffer; ext: string } {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUri ?? '');
  if (!m) throw new BadRequestException('Ảnh không hợp lệ');
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  if (!(IMAGE_MIME as readonly string[]).includes(mime)) {
    throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  }
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0) throw new BadRequestException('Ảnh rỗng');
  if (buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('Ảnh tối đa 5 MB');
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { mime, buffer, ext };
}
