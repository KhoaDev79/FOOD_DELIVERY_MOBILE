import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { formatAddress, isCoordinateAddress, isInferredMockAddress } from '../../common/utils/address.util';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/users.dto';

/** Loại bỏ các trường nhạy cảm trước khi trả về client. */
export function toPublicUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, refreshTokenHash, expoPushToken, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return toPublicUser(user);
  }

  async updatePushToken(userId: string, expoPushToken: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { expoPushToken } });
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) throw new BadRequestException('Mật khẩu hiện tại không chính xác');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });
    return { ok: true, message: 'Đổi mật khẩu thành công' };
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (isCoordinateAddress(dto.addressLine)) {
      throw new BadRequestException(
        'Địa chỉ không hợp lệ. Vui lòng chọn vị trí có tên đường, phường/xã cụ thể thay vì toạ độ thô.',
      );
    }
    const cleanAddressLine = formatAddress(dto.addressLine);

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const isDefault = dto.isDefault ?? count === 0;
      if (isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          ...dto,
          addressLine: cleanAddressLine,
          userId,
          isDefault,
        },
      });
    });
  }

  async setDefaultAddress(userId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      const updated = await tx.address.update({
        where: { id: addressId, userId },
        data: { isDefault: true },
      });
      return updated;
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy địa chỉ hoặc bạn không có quyền thao tác');
    }

    let cleanAddressLine = dto.addressLine;
    let needsConfirmation = dto.needsConfirmation;

    if (cleanAddressLine !== undefined) {
      if (isCoordinateAddress(cleanAddressLine)) {
        throw new BadRequestException('Không thể lưu toạ độ làm địa chỉ. Vui lòng nhập tên đường cụ thể.');
      }
      cleanAddressLine = formatAddress(cleanAddressLine);
      if (isInferredMockAddress(cleanAddressLine)) {
        needsConfirmation = true;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...dto,
          ...(cleanAddressLine !== undefined ? { addressLine: cleanAddressLine } : {}),
          ...(needsConfirmation !== undefined ? { needsConfirmation } : {}),
        },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const { count } = await this.prisma.address.deleteMany({ where: { id: addressId, userId } });
    if (!count) throw new NotFoundException('Không tìm thấy địa chỉ');
  }
}
