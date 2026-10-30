import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, RoleRequestStatus, VehicleType } from '@prisma/client';
import { isValidVietnameseLicensePlate, normalizeLicensePlate } from '../../common/utils/vietnamese-plate.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleRequestDto } from './dto/role-request.dto';

const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

@Injectable()
export class RoleRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.roleUpgradeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async create(userId: string, dto: CreateRoleRequestDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.role !== Role.CUSTOMER) {
      throw new BadRequestException('Chỉ tài khoản Khách hàng mới có thể gửi yêu cầu nâng cấp');
    }
    const pending = await this.prisma.roleUpgradeRequest.findFirst({
      where: { userId, status: RoleRequestStatus.PENDING },
    });
    if (pending) throw new ConflictException('Bạn đã có một yêu cầu đang chờ duyệt');

    let metadata: Prisma.InputJsonValue;
    if (dto.requestedRole === Role.RESTAURANT_OWNER) {
      const restaurantName = clean(dto.restaurantName);
      if (!restaurantName) throw new BadRequestException('Vui lòng nhập tên quán dự kiến');
      metadata = { restaurantName, restaurantAddress: clean(dto.restaurantAddress) };
    } else {
      const vehicleType = dto.vehicleType ?? VehicleType.MOTORBIKE;
      let licensePlate: string | null = null;
      if (vehicleType !== VehicleType.BICYCLE) {
        licensePlate = normalizeLicensePlate(dto.licensePlate);
        if (!licensePlate) throw new BadRequestException('Biển số xe là bắt buộc đối với xe máy và xe máy điện');
        if (!isValidVietnameseLicensePlate(licensePlate)) {
          throw new BadRequestException('Biển số xe không hợp lệ. Ví dụ đúng: 59-X1 123.45');
        }
        const dup = await this.prisma.driverProfile.findFirst({ where: { licensePlate } });
        if (dup) throw new ConflictException('Biển số xe này đã được đăng ký bởi tài xế khác');
      }
      metadata = {
        vehicleType,
        vehicleBrand: clean(dto.vehicleBrand),
        vehicleModel: clean(dto.vehicleModel),
        vehicleColor: clean(dto.vehicleColor),
        licensePlate,
      };
    }

    return this.prisma.roleUpgradeRequest.create({
      data: { userId, requestedRole: dto.requestedRole, metadata, note: clean(dto.note) },
    });
  }
}
