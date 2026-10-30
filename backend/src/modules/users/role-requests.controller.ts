import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRoleRequestDto } from './dto/role-request.dto';
import { RoleRequestsService } from './role-requests.service';

/** Khách hàng gửi / xem yêu cầu trở thành Chủ quán hoặc Tài xế. */
@Controller('users')
export class RoleRequestsController {
  constructor(private readonly roleRequests: RoleRequestsService) {}

  @Post('request-upgrade')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateRoleRequestDto) {
    return this.roleRequests.create(userId, dto);
  }

  @Get('request-upgrade')
  listMine(@CurrentUser('id') userId: string) {
    return this.roleRequests.listMine(userId);
  }
}
