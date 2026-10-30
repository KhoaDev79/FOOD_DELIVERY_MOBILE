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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  AdminCreateRestaurantDto,
  AdminUpdateRestaurantDto,
  AssignOwnerDto,
  ChangeUserRoleDto,
  ListAdminOrdersQueryDto,
  ListAdminRestaurantsQueryDto,
  ListRoleRequestsQueryDto,
  ListUsersQueryDto,
  ReviewRoleRequestDto,
  ToggleUserActiveDto,
} from './dto/admin.dto';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  /* ------------------------------ Người dùng ------------------------------ */

  @Get('users')
  listUsers(@Query() q: ListUsersQueryDto) {
    return this.adminService.listUsers(q);
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ToggleUserActiveDto,
  ) {
    return this.adminService.toggleUserActive(id, adminId, dto);
  }

  @Patch('users/:id/role')
  changeUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.adminService.changeUserRole(id, adminId, dto);
  }

  @Get('users/:id/activity')
  getUserActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserActivity(id);
  }

  /* ------------------------------- Quán ăn ------------------------------- */

  @Get('restaurants')
  listRestaurants(@Query() q: ListAdminRestaurantsQueryDto) {
    return this.adminService.listRestaurants(q);
  }

  @Get('restaurants/:id')
  getRestaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getRestaurantDetail(id);
  }

  @Post('restaurants')
  createRestaurant(@Body() dto: AdminCreateRestaurantDto) {
    return this.adminService.createRestaurant(dto);
  }

  @Patch('restaurants/:id')
  updateRestaurant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateRestaurantDto) {
    return this.adminService.updateRestaurant(id, dto);
  }

  @Patch('restaurants/:id/assign-owner')
  assignOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: AssignOwnerDto,
  ) {
    return this.adminService.assignRestaurantOwner(id, dto.ownerId, adminId);
  }

  @Patch('restaurants/:id/toggle-open')
  toggleRestaurantOpen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.toggleRestaurantOpen(id, adminId);
  }

  @Delete('restaurants/:id')
  deleteRestaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteRestaurant(id);
  }

  @Delete('menu-items/:id')
  deleteMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteMenuItem(id);
  }

  /* ----------------------- Yêu cầu nâng cấp vai trò ----------------------- */

  @Get('role-requests')
  listRoleRequests(@Query() q: ListRoleRequestsQueryDto) {
    return this.adminService.listRoleRequests(q);
  }

  @Patch('role-requests/:id/review')
  reviewRoleRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewRoleRequestDto,
  ) {
    return this.adminService.reviewRoleRequest(id, adminId, dto);
  }

  /* -------------------------------- Đơn hàng -------------------------------- */

  @Get('orders')
  listOrders(@Query() q: ListAdminOrdersQueryDto) {
    return this.adminService.listOrders(q);
  }
}
