import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menus.dto';

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
    return this.prisma.menuItem.create({ data: { ...dto, restaurantId } });
  }

  async updateItem(itemId: string, user: AuthUser, dto: UpdateMenuItemDto) {
    const item = await this.findActiveItem(itemId);
    await this.restaurants.assertCanManage(item.restaurantId, user);
    if (dto.categoryId) await this.assertCategoryBelongs(dto.categoryId, item.restaurantId);
    return this.prisma.menuItem.update({ where: { id: itemId }, data: dto });
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
