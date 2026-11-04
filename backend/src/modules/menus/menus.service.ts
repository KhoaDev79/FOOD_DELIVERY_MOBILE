import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menus.dto';
import { Prisma } from '@prisma/client';
import { discountPercentOf, discountPriceFor } from './menu-discount';
import { normalizeMenuOptions } from './menu-options';
import { stockPatch, StockStatus } from './menu-stock.util';
import { OrdersGateway } from '../realtime/orders.gateway';

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
    private readonly media: MediaService,
    private readonly gateway: OrdersGateway,
  ) {}

  async createCategory(restaurantId: string, user: AuthUser, dto: CreateCategoryDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.prisma.category.create({ data: { ...dto, restaurantId } });
  }

  async createItem(restaurantId: string, user: AuthUser, dto: CreateMenuItemDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    if (dto.categoryId) await this.assertCategoryBelongs(dto.categoryId, restaurantId);
    const { discountPercent, options, imageUrl: rawImageUrl, ...data } = dto;
    const imageUrl = await this.media.resolveImage(rawImageUrl, 'dishes');
    const normalized = normalizeMenuOptions(options);
    return this.prisma.menuItem.create({
      data: {
        ...data,
        imageUrl,
        restaurantId,
        discountPrice: discountPriceFor(data.price, discountPercent ?? 0),
        ...(normalized ? { options: normalized as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async updateItem(itemId: string, user: AuthUser, dto: UpdateMenuItemDto) {
    const item = await this.findActiveItem(itemId);
    await this.restaurants.assertCanManage(item.restaurantId, user);
    if (dto.categoryId) await this.assertCategoryBelongs(dto.categoryId, item.restaurantId);
    const { discountPercent, options, imageUrl: rawImageUrl, ...data } = dto;
    const resolvedImageUrl =
      rawImageUrl !== undefined ? await this.media.resolveImage(rawImageUrl, 'dishes') : undefined;
    const price = data.price ?? item.price;
    // Đổi mức giảm, hoặc đổi giá mà giữ nguyên mức giảm cũ: tính lại giá giảm từ giá mới
    const percent = discountPercent ?? (data.price !== undefined ? discountPercentOf(item.price, item.discountPrice) : undefined);
    // options: bỏ trống = giữ nguyên; null hoặc rỗng = xoá; có dữ liệu = chuẩn hoá, giữ id cũ
    const optionsPatch =
      options === undefined
        ? {}
        : (() => {
            const normalized = normalizeMenuOptions(options, item.options);
            return { options: normalized ? (normalized as unknown as Prisma.InputJsonValue) : Prisma.DbNull };
          })();
    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...data,
        // Bật/tắt bằng công tắc cũ: bỏ hẹn giờ "hết hôm nay" (tắt = hết đến khi bật lại)
        ...(data.isAvailable !== undefined ? { soldOutUntil: null } : {}),
        ...(resolvedImageUrl !== undefined ? { imageUrl: resolvedImageUrl } : {}),
        ...optionsPatch,
        ...(percent === undefined ? {} : { discountPrice: discountPriceFor(price, percent) }),
      },
    });
    if (data.isAvailable !== undefined && data.isAvailable !== item.isAvailable) this.emitStock(updated);
    return updated;
  }

  /** Quán đổi tình trạng món: còn hàng / hết hôm nay / hết đến khi bật lại. Báo ngay cho khách đang xem quán. */
  async setStock(itemId: string, user: AuthUser, status: StockStatus, now = new Date()) {
    const item = await this.findActiveItem(itemId);
    await this.restaurants.assertCanManage(item.restaurantId, user);
    const updated = await this.prisma.menuItem.update({ where: { id: itemId }, data: stockPatch(status, now) });
    this.emitStock(updated);
    return updated;
  }

  private emitStock(item: { id: string; restaurantId: string; isAvailable: boolean; soldOutUntil: Date | null }) {
    this.gateway.emitMenuStock({
      restaurantId: item.restaurantId,
      items: [{ id: item.id, isAvailable: item.isAvailable, soldOutUntil: item.soldOutUntil?.toISOString() ?? null }],
    });
  }

  /** Soft delete: món cũ vẫn được OrderItem tham chiếu. */
  async archiveItem(itemId: string, user: AuthUser) {
    const item = await this.findActiveItem(itemId);
    await this.restaurants.assertCanManage(item.restaurantId, user);
    await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isArchived: true, isAvailable: false },
    });
  }

  private async findActiveItem(itemId: string) {
    const item = await this.prisma.menuItem.findFirst({ where: { id: itemId, isArchived: false } });
    if (!item) throw new NotFoundException('Không tìm thấy món ăn');
    return item;
  }

  private async assertCategoryBelongs(categoryId: string, restaurantId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
    if (!cat) throw new BadRequestException('Danh mục không thuộc nhà hàng này');
  }
}
