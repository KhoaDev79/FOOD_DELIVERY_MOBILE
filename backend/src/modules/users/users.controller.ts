import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BufferedFile } from '../../common/types/file.interface';
import { ChangePasswordDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto, UpdatePushTokenDto } from './dto/users.dto';
import { FavoritesService } from './favorites.service';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly favorites: FavoritesService,
  ) {}

  /* ------------------- Quán yêu thích (theo tài khoản) ------------------- */

  @Get('favorites')
  listFavorites(@CurrentUser('id') userId: string) {
    return this.favorites.list(userId);
  }

  @Put('favorites/:restaurantId')
  addFavorite(@CurrentUser('id') userId: string, @Param('restaurantId', ParseUUIDPipe) restaurantId: string) {
    return this.favorites.add(userId, restaurantId);
  }

  @Delete('favorites/:restaurantId')
  removeFavorite(@CurrentUser('id') userId: string, @Param('restaurantId', ParseUUIDPipe) restaurantId: string) {
    return this.favorites.remove(userId, restaurantId);
  }

  @Get()
  me(@CurrentUser('id') userId: string) {
    return this.users.getMe(userId);
  }

  @Patch()
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(userId, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WebP'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: BufferedFile,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    }
    return this.users.uploadAvatar(userId, file);
  }

  @Patch('password')
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(userId, dto);
  }

  @Put('push-token')
  pushToken(@CurrentUser('id') userId: string, @Body() dto: UpdatePushTokenDto) {
    return this.users.updatePushToken(userId, dto.expoPushToken);
  }

  @Get('addresses')
  addresses(@CurrentUser('id') userId: string) {
    return this.users.listAddresses(userId);
  }

  @Post('addresses')
  addAddress(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.users.createAddress(userId, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.users.updateAddress(userId, id, dto);
  }

  @Patch('addresses/:id/default')
  setDefaultAddress(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setDefaultAddress(userId, id);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAddress(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.deleteAddress(userId, id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUser('id') userId: string) {
    return this.users.deleteAccount(userId);
  }
}
