import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DriversService } from './drivers.service';
import { AdminVerifyDriverDto, ListDriversAdminQueryDto } from './dto/drivers.dto';

@Roles(Role.ADMIN)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  listDrivers(@Query() query: ListDriversAdminQueryDto) {
    return this.driversService.adminListDrivers(query);
  }

  @Patch(':userId/verify')
  verifyDriver(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminVerifyDriverDto,
  ) {
    return this.driversService.adminVerifyDriver(userId, adminId, dto);
  }
}

