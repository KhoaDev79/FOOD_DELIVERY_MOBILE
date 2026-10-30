import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { RoleRequestsController } from './role-requests.controller';
import { RoleRequestsService } from './role-requests.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, RoleRequestsController],
  providers: [UsersService, RoleRequestsService, FavoritesService],
  exports: [UsersService],
})
export class UsersModule {}
