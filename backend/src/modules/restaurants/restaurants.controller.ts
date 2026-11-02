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
  ListRestaurantReviewsQueryDto,
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

  /** GET /restaurants/:id/reviews?page=1&limit=20&rating=5 – danh sách đánh giá công khai (E3). */
  @Public()
  @Get(':id/reviews')
  getPublicReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRestaurantReviewsQueryDto,
  ) {
    return this.restaurants.getPublicReviews(id, query);
  }

  /** GET /restaurants/:id/reviews/manage?page=1&limit=20&unrepliedOnly=true – quản lý đánh giá cho Chủ quán / ADMIN (E3). */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get(':id/reviews/manage')
  getManageReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListRestaurantReviewsQueryDto,
  ) {
    return this.restaurants.getManageReviews(id, user, query);
  }

  /** Gợi ý món thêm vào giỏ ("Thường được đặt cùng"). itemIds: các món đang có trong giỏ, cách nhau dấu phẩy. */
  @Public()
  @Get(':id/suggestions')
  suggestions(@Param('id', ParseUUIDPipe) id: string, @Query('itemIds') itemIdsRaw?: string) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const itemIds = (itemIdsRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => UUID_RE.test(s))
      .slice(0, 30);
    return this.restaurants.getSuggestions(id, itemIds);
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
