import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RestaurantStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  absoluteImageUrl,
  APP_SCHEME,
  formatVnd,
  renderNotFoundPage,
  renderSharePage,
  requestOrigin,
} from './share-page.util';

/**
 * Link chia sẻ ngắn, KHÔNG nằm dưới /api/v1 (xem main.ts): /s/r/:id (quán), /s/d/:id (món).
 * Trả HTML có thẻ Open Graph để Zalo/Messenger hiện ảnh xem trước, kèm nút mở app hoặc bản web.
 */
@Public()
@Controller('s')
export class ShareController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Bản web đã deploy (tuỳ chọn), vd https://zomzom.duckdns.org */
  private webLink(path: string): string | null {
    const base = this.config.get<string>('WEB_APP_URL')?.trim().replace(/\/+$/, '');
    return base ? `${base}/${path}` : null;
  }

  /** Link do người dùng gõ/cắt dán có thể hỏng: trả trang HTML thân thiện thay vì lỗi JSON. */
  private static isUuid(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  private send(res: Response, status: number, html: string) {
    // Cho mạng xã hội lưu tạm 10 phút: đổi ảnh/tên quán thì thẻ xem trước cập nhật sau ít phút
    res.status(status).type('html').set('Cache-Control', 'public, max-age=600').send(html);
  }

  @Get('r/:id')
  async restaurant(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    if (!ShareController.isUuid(id)) return this.send(res, 404, renderNotFoundPage('Link chia sẻ không hợp lệ.'));
    const r = await this.prisma.restaurant.findUnique({
      where: { id },
      select: { id: true, name: true, address: true, imageUrl: true, rating: true, ratingCount: true, status: true },
    });
    if (!r || r.status !== RestaurantStatus.ACTIVE) {
      return this.send(res, 404, renderNotFoundPage('Quán này không còn hoạt động trên ZomZom.'));
    }
    const origin = requestOrigin(req.headers, req.protocol);
    const path = `restaurant/${r.id}`;
    const stars = r.ratingCount > 0 ? `⭐ ${r.rating.toFixed(1)} (${r.ratingCount} đánh giá) · ` : '';
    return this.send(
      res,
      200,
      renderSharePage({
        title: r.name,
        description: `${stars}${r.address}`,
        imageUrl: absoluteImageUrl(r.imageUrl, origin),
        appUrl: `${APP_SCHEME}://${path}`,
        webUrl: this.webLink(path),
        pageUrl: `${origin}/s/r/${r.id}`,
      }),
    );
  }

  @Get('d/:id')
  async dish(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    if (!ShareController.isUuid(id)) return this.send(res, 404, renderNotFoundPage('Link chia sẻ không hợp lệ.'));
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        imageUrl: true,
        isArchived: true,
        restaurant: { select: { id: true, name: true, imageUrl: true, status: true } },
      },
    });
    if (!item || item.isArchived || item.restaurant.status !== RestaurantStatus.ACTIVE) {
      return this.send(res, 404, renderNotFoundPage('Món này không còn bán trên ZomZom.'));
    }
    const origin = requestOrigin(req.headers, req.protocol);
    const path = `restaurant/${item.restaurant.id}?openDishId=${item.id}`;
    const hasDeal = item.discountPrice !== null && item.discountPrice < item.price;
    const price = hasDeal ? item.discountPrice! : item.price;
    return this.send(
      res,
      200,
      renderSharePage({
        title: `${item.name} – ${item.restaurant.name}`,
        description: `${formatVnd(price)}${item.description ? ` · ${item.description}` : ''}`,
        imageUrl: absoluteImageUrl(item.imageUrl, origin) ?? absoluteImageUrl(item.restaurant.imageUrl, origin),
        appUrl: `${APP_SCHEME}://${path}`,
        webUrl: this.webLink(path),
        pageUrl: `${origin}/s/d/${item.id}`,
        badge: hasDeal ? `Giảm ${Math.round((1 - price / item.price) * 100)}% · giá gốc ${formatVnd(item.price)}` : null,
      }),
    );
  }
}
