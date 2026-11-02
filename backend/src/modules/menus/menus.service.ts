import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menus.dto';
import { Prisma } from '@prisma/client';
import { discountPercentOf, discountPriceFor } from './menu-discount';
import { normalizeMenuOptions } from './menu-options';

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  async createCategory(restaurantId: string, user: AuthUser, dto: CreateCategoryDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.prisma.category.create({ data: { ...dto, restaurantId } });
  }

  async createItem(restaurantId: string, user: AuthUser, dto: CreateMenuItemDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    if (dto.categoryId) await this.assertCategoryBelongs(dto.categoryId, restaurantId);
    const { discountPercent, options, ...data } = dto;
    const normalized = normalizeMenuOptions(options);
    return this.prisma.menuItem.create({
      data: {
        ...data,
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
    const { discountPercent, options, ...data } = dto;
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
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...data,
        ...optionsPatch,
        ...(percent === undefined ? {} : { discountPrice: discountPriceFor(price, percent) }),
      },
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
