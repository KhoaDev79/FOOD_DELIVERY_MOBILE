import { Module } from '@nestjs/common';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [RestaurantsModule],
  controllers: [MenusController],
  providers: [MenusService],
})
export class MenusModule {}
