import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DriversService } from './drivers.service';
import {
  DriverLedgerQueryDto,
  DriverReviewQueryDto,
  ReplyReviewDto,
  UpdateDriverLocationDto,
  UpdateDriverStatusDto,
  UpdateDriverVehicleDto,
} from './dto/drivers.dto';

@Roles(Role.DRIVER)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.driversService.getMe(userId);
  }

  @Get('me/reviews')
  getMyReviews(
    @CurrentUser('id') userId: string,
    @Query() query: DriverReviewQueryDto,
  ) {
    return this.driversService.getMyReviews(userId, query);
  }

  @Post('me/reviews/:id/reply')
  replyReview(
    @CurrentUser('id') userId: string,
    @Param('id') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.driversService.replyReview(userId, reviewId, dto.reply);
  }

  @Get('me/ledger')
  getMyLedger(
    @CurrentUser('id') userId: string,
    @Query() query: DriverLedgerQueryDto,
  ) {
    return this.driversService.getMyLedger(userId, query);
  }

  @Patch('me/vehicle')
  updateVehicle(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDriverVehicleDto,
  ) {
    return this.driversService.updateVehicle(userId, dto);
  }

  @Patch('me/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    return this.driversService.updateStatus(userId, dto);
  }

  @Patch('me/location')
  updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    return this.driversService.updateLocation(userId, dto);
  }
}
