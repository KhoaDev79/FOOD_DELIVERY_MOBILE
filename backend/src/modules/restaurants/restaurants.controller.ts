import {
  BadRequestException,
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
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateRestaurantDto,
  NearbyRestaurantsQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurants.dto';
import { STATS_RANGES, StatsRange } from './restaurant-stats';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  /** GET /restaurants/nearby?lat=10.77&lng=106.70&radiusKm=5&q=phở */
  @Public()
  @Get('nearby')
  nearby(@Query() query: NearbyRestaurantsQueryDto) {
    return this.restaurants.findNearby(query);
  }

  /**
   * GET /restaurants/nearby/dishes?lat=..&lng=..&radiusKm=..&limit=..
   * Món đang bán của các quán đang mở trong bán kính giao hàng (chỉ đọc, dùng cho trang chủ).
   */
  @Public()
  @Get('nearby/dishes')
  nearbyDishes(@Query() query: NearbyRestaurantsQueryDto) {
    return this.restaurants.findNearbyDishes(query);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.restaurants.findMine(userId);
  }

  /** GET /restaurants/:id/stats?days=1|7|30 – doanh thu, số đơn, món bán chạy (chủ quán / ADMIN). */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get(':id/stats')
  stats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('days') daysRaw?: string,
  ) {
    const days = Number(daysRaw ?? 7) as StatsRange;
    if (!STATS_RANGES.includes(days)) {
      throw new BadRequestException('days chỉ nhận 1, 7 hoặc 30');
    }
    return this.restaurants.getStats(id, user, days);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
  ) {
    const lat = latRaw !== undefined ? Number(latRaw) : undefined;
    const lng = lngRaw !== undefined ? Number(lngRaw) : undefined;
    return this.restaurants.findOneWithMenu(id, user, lat, lng);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRestaurantDto) {
    return this.restaurants.create(user, dto);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurants.update(id, user, dto);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.restaurants.delete(id, user);
  }
}
