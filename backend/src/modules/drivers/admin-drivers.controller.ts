import {
  Body,
  Controller,
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
import { DriversService } from './drivers.service';
import {
  AdminDriversLedgerQueryDto,
  AdminVerifyDriverDto,
  DriverAdjustmentDto,
  DriverLedgerQueryDto,
  DriverSettlementDto,
  ListDriversAdminQueryDto,
} from './dto/drivers.dto';

@Roles(Role.ADMIN)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  listDrivers(@Query() query: ListDriversAdminQueryDto) {
    return this.driversService.adminListDrivers(query);
  }

  @Get('ledger')
  listLedgers(@Query() query: AdminDriversLedgerQueryDto) {
    return this.driversService.adminListDriverLedgers(query);
  }

  @Get(':userId/ledger')
  getDriverLedger(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: DriverLedgerQueryDto,
  ) {
    return this.driversService.adminGetDriverLedger(userId, query);
  }

  @Post(':userId/settlements')
  recordSettlement(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: DriverSettlementDto,
  ) {
    return this.driversService.adminRecordSettlement(userId, adminId, dto);
  }

  @Post(':userId/adjustments')
  recordAdjustment(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: DriverAdjustmentDto,
  ) {
    return this.driversService.adminRecordAdjustment(userId, adminId, dto);
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
