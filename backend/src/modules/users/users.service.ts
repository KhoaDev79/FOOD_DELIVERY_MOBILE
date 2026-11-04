import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OrderStatus, Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { extname } from 'path';
import { BufferedFile } from '../../common/types/file.interface';
import { formatAddress, isCoordinateAddress, isInferredMockAddress } from '../../common/utils/address.util';
import { AuthStateService } from '../auth/auth-state.service';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/users.dto';
import { canDeleteUserAccount, generateAnonymizedEmail } from './user-deletion.util';

/** Loại bỏ các trường nhạy cảm trước khi trả về client. */
export function toPublicUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, refreshTokenHash, expoPushToken, googleId, ...rest } = user;
  // Chỉ cho app biết tài khoản đã liên kết Google hay chưa, không trả mã Google
  return { ...rest, hasGoogle: !!googleId };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authState: AuthStateService,
    private readonly media: MediaService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.phone) {
      const owner = await this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { id: true } });
      if (owner && owner.id !== userId) {
        throw new ConflictException('Số điện thoại này đã được đăng ký cho tài khoản khác.');
      }
    }
    let resolvedAvatarUrl: string | null | undefined = undefined;
    if (dto.avatarUrl !== undefined) {
      resolvedAvatarUrl = await this.media.resolveImage(dto.avatarUrl, 'avatars');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        ...(resolvedAvatarUrl !== undefined ? { avatarUrl: resolvedAvatarUrl } : {}),
      },
    });
    return toPublicUser(user);
  }

  async uploadAvatar(userId: string, file: BufferedFile) {
    const ext = (extname(file.originalname) || '.jpg').replace(/^\./, '');
    const uploadRes = await this.media.uploadBuffer(file.buffer, file.mimetype, ext, 'avatars');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: uploadRes.url },
    });
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

  /**
   * Xoá tài khoản người dùng theo chuẩn App Store / Google Play:
   * - Kiểm tra các ràng buộc: không có đơn đang xử lý, tài xế không còn nợ COD.
   * - Ẩn danh toàn bộ thông tin cá nhân (họ tên, email, SĐT, username, avatar).
   * - Xoá địa chỉ đã lưu & danh mục yêu thích.
   * - Thu hồi refresh token và vô hiệu hoá tài khoản ngay lập tức.
   * - Ghi AuditLog lưu lại sự kiện ẩn danh.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
        restaurants: { select: { id: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng hoặc tài khoản đã bị vô hiệu hoá');
    }

    const ACTIVE_STATUSES: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.PICKED_UP,
    ];

    const [activeCustomerOrders, activeDriverOrders, activeOwnerOrders] = await Promise.all([
      this.prisma.order.count({
        where: { customerId: userId, status: { in: ACTIVE_STATUSES } },
      }),
      user.role === Role.DRIVER
        ? this.prisma.order.count({
            where: {
              driverId: userId,
              status: {
                in: [
                  OrderStatus.CONFIRMED,
                  OrderStatus.PREPARING,
                  OrderStatus.READY_FOR_PICKUP,
                  OrderStatus.PICKED_UP,
                ],
              },
            },
          })
        : 0,
      user.role === Role.RESTAURANT_OWNER && user.restaurants.length > 0
        ? this.prisma.order.count({
            where: {
              restaurantId: { in: user.restaurants.map((r) => r.id) },
              status: { in: ACTIVE_STATUSES },
            },
          })
        : 0,
    ]);

    const check = canDeleteUserAccount({
      role: user.role,
      activeCustomerOrdersCount: activeCustomerOrders,
      activeDriverOrdersCount: activeDriverOrders,
      activeRestaurantOrdersCount: activeOwnerOrders,
      driverCodBalance: user.driverProfile?.codBalance ?? 0,
    });

    if (!check.allowed) {
      throw new BadRequestException(check.reason);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Xoá địa chỉ đã lưu & danh mục yêu thích
      await tx.address.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });

      // 2. Nếu là tài xế: chuyển trạng thái sang offline
      if (user.role === Role.DRIVER && user.driverProfile) {
        await tx.driverProfile.update({
          where: { userId },
          data: { isOnline: false },
        });
      }

      // 3. Nếu là chủ quán: chuyển các quán sang đóng cửa và tạm dừng
      if (user.role === Role.RESTAURANT_OWNER && user.restaurants.length > 0) {
        await tx.restaurant.updateMany({
          where: { ownerId: userId },
          data: { isOpen: false, status: 'SUSPENDED', suspendReason: 'Chủ quán đã xoá tài khoản' },
        });
      }

      // 4. Ẩn danh dữ liệu cá nhân, giải phóng email & SĐT gốc
      const anonymizedEmail = generateAnonymizedEmail(userId);
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: 'Tài khoản đã xoá',
          email: anonymizedEmail,
          phone: null,
          username: null,
          avatarUrl: null,
          expoPushToken: null,
          refreshTokenHash: null,
          isActive: false,
        },
      });

      // 5. Ghi nhật ký quản trị AuditLog
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_DELETE_ACCOUNT',
          targetType: 'User',
          targetId: userId,
          metadata: {
            originalRole: user.role,
            anonymizedAt: new Date().toISOString(),
          },
        },
      });
    });

    // 6. Xoá cache xác thực trong bộ nhớ
    this.authState.invalidate(userId);

    return { ok: true, message: 'Tài khoản của bạn đã được xoá thành công.' };
  }
}
