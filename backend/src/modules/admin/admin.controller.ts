import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  AdminCreateRestaurantDto,
  AdminUpdateRestaurantDto,
  ListAdminOrdersQueryDto,
  ListUsersQueryDto,
} from './dto/admin.dto';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  listUsers(@Query() q: ListUsersQueryDto) {
    return this.adminService.listUsers(q);
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserActive(id);
  }

  @Get('restaurants')
  listRestaurants(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('q') q?: string,
  ) {
    return this.adminService.listRestaurants(Number(page) || 1, Number(limit) || 20, q);
  }

  @Post('restaurants')
  createRestaurant(@Body() dto: AdminCreateRestaurantDto) {
    return this.adminService.createRestaurant(dto);
  }

  @Patch('restaurants/:id')
  updateRestaurant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateRestaurantDto,
  ) {
    return this.adminService.updateRestaurant(id, dto);
  }

  @Delete('restaurants/:id')
  deleteRestaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteRestaurant(id);
  }

  @Delete('menu-items/:id')
  deleteMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteMenuItem(id);
  }

  @Patch('restaurants/:id/toggle-open')
  toggleRestaurantOpen(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleRestaurantOpen(id);
  }

  @Get('orders')
  listOrders(@Query() q: ListAdminOrdersQueryDto) {
    return this.adminService.listOrders(q);
  }
}

