import {
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
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChangePasswordDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto, UpdatePushTokenDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser('id') userId: string) {
    return this.users.getMe(userId);
  }

  @Patch()
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(userId, dto);
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
}
