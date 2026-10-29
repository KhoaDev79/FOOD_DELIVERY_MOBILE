import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menus.dto';
import { MenusService } from './menus.service';

/** Thực đơn công khai được trả về qua GET /restaurants/:id */
@Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
@Controller()
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Post('restaurants/:restaurantId/categories')
  createCategory(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menus.createCategory(restaurantId, user, dto);
  }

  @Post('restaurants/:restaurantId/menu-items')
  createItem(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menus.createItem(restaurantId, user, dto);
  }

  @Patch('menu-items/:id')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menus.updateItem(id, user, dto);
  }

  @Delete('menu-items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.menus.archiveItem(id, user);
  }
}
