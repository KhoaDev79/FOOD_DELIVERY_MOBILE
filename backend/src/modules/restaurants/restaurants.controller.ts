import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateRestaurantDto,
  NearbyRestaurantsQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurants.dto';
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

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.restaurants.findMine(userId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.restaurants.findOneWithMenu(id);
  }

  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRestaurantDto) {
    const ownerId = user.role === Role.ADMIN && dto.ownerId ? dto.ownerId : user.id;
    return this.restaurants.create(ownerId, dto);
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
