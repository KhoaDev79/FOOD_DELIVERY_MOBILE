import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriverProfile, DriverVerificationStatus, Prisma, Role, VehicleType } from '@prisma/client';
import {
  isValidVietnameseLicensePlate,
  maskBankAccountNumber,
  normalizeLicensePlate,
} from '../../common/utils/vietnamese-plate.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminVerifyDriverDto,
  ListDriversAdminQueryDto,
  UpdateDriverLocationDto,
  UpdateDriverStatusDto,
  UpdateDriverVehicleDto,
} from './dto/drivers.dto';

const LOCATION_RATE_LIMIT_SECONDS = 15;

export type SanitizedDriverProfile = Omit<DriverProfile, 'bankAccountNumber'> & {
  bankAccountNumber: string | null;
  maskedBankAccountNumber: string | null;
};

function sanitizeProfile(profile: DriverProfile): SanitizedDriverProfile {
  return {
    ...profile,
    bankAccountNumber: maskBankAccountNumber(profile.bankAccountNumber),
    maskedBankAccountNumber: maskBankAccountNumber(profile.bankAccountNumber),
  };
}

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy hồ sơ tài xế hiện hành (tự khởi tạo trạng thái PENDING nếu chưa có). */
  async getMe(userId: string): Promise<SanitizedDriverProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.DRIVER) {
      throw new ForbiddenException('Chỉ tài xế mới có quyền truy cập hồ sơ này');
    }

    let profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await this.prisma.driverProfile.create({
        data: {
          userId,
          vehicleType: VehicleType.MOTORBIKE,
          verificationStatus: DriverVerificationStatus.PENDING,
          isOnline: false,
        },
      });
    }

    return sanitizeProfile(profile);
  }

  /**
   * Cập nhật thông tin xe & thanh toán:
   * Nếu đổi vehicleType hoặc licensePlate thì hồ sơ tự động quay về PENDING và chuyển ngoại tuyến.
   */
  async updateVehicle(userId: string, dto: UpdateDriverVehicleDto): Promise<SanitizedDriverProfile> {
    const existing = await this.getMe(userId);

    const vehicleType = dto.vehicleType ?? existing.vehicleType;
    let licensePlate = dto.licensePlate !== undefined ? normalizeLicensePlate(dto.licensePlate) : existing.licensePlate;

    // Kiểm tra tính hợp lệ của biển số xe
    if (vehicleType !== VehicleType.BICYCLE) {
      if (!licensePlate) {
        throw new BadRequestException('Biển số xe là bắt buộc đối với xe máy và xe máy điện');
      }
      if (!isValidVietnameseLicensePlate(licensePlate)) {
        throw new BadRequestException(
          'Định dạng biển số xe không hợp lệ. Ví dụ đúng: 59-X1 123.45 hoặc 29-H1 888.88',
        );
      }

      // Kiểm tra trùng biển số xe với tài xế khác
      const duplicate = await this.prisma.driverProfile.findFirst({
        where: {
          licensePlate,
          userId: { not: userId },
        },
      });
      if (duplicate) {
        throw new ConflictException('Biển số xe này đã được đăng ký bởi tài xế khác');
      }
    } else {
      licensePlate = null;
    }

    // Nếu thay đổi loại xe hoặc biển số xe -> reset trạng thái duyệt về PENDING và tự chuyển ngoại tuyến
    const isVehicleCriticalChange =
      (dto.vehicleType !== undefined && dto.vehicleType !== existing.vehicleType) ||
      (dto.licensePlate !== undefined && licensePlate !== existing.licensePlate);

    const updateData: Prisma.DriverProfileUpdateInput = {
      vehicleType,
      vehicleBrand: dto.vehicleBrand !== undefined ? dto.vehicleBrand?.trim() || null : existing.vehicleBrand,
      vehicleModel: dto.vehicleModel !== undefined ? dto.vehicleModel?.trim() || null : existing.vehicleModel,
      vehicleColor: dto.vehicleColor !== undefined ? dto.vehicleColor?.trim() || null : existing.vehicleColor,
      licensePlate,
      driverLicenseClass:
        dto.driverLicenseClass !== undefined
          ? dto.driverLicenseClass?.trim() || null
          : existing.driverLicenseClass,
      emergencyContactName:
        dto.emergencyContactName !== undefined
          ? dto.emergencyContactName?.trim() || null
          : existing.emergencyContactName,
      emergencyContactPhone:
        dto.emergencyContactPhone !== undefined
          ? dto.emergencyContactPhone?.trim() || null
          : existing.emergencyContactPhone,
      bankName: dto.bankName !== undefined ? dto.bankName?.trim() || null : existing.bankName,
      bankAccountNumber:
        dto.bankAccountNumber !== undefined
          ? dto.bankAccountNumber?.trim() || null
          : existing.bankAccountNumber,
      bankAccountName:
        dto.bankAccountName !== undefined
          ? dto.bankAccountName?.trim().toUpperCase() || null
          : existing.bankAccountName,
    };

    if (isVehicleCriticalChange) {
      updateData.verificationStatus = DriverVerificationStatus.PENDING;
      updateData.rejectionReason = null;
      updateData.isOnline = false;
    }

    const updated = await this.prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    return sanitizeProfile(updated);
  }

  /**
   * Cập nhật trạng thái trực tuyến / ngoại tuyến:
   * Chỉ hồ sơ APPROVED và tài khoản User đang hoạt động mới được phép bật trực tuyến.
   */
  async updateStatus(userId: string, dto: UpdateDriverStatusDto): Promise<SanitizedDriverProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new ForbiddenException('Tài khoản của bạn đang bị khoá. Vui lòng liên hệ bộ phận hỗ trợ.');
    }

    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ tài xế');
    }

    if (dto.isOnline) {
      if (profile.verificationStatus === DriverVerificationStatus.PENDING) {
        throw new BadRequestException('Hồ sơ phương tiện của bạn đang chờ phê duyệt.');
      }
      if (profile.verificationStatus === DriverVerificationStatus.REJECTED) {
        throw new BadRequestException(
          `Hồ sơ của bạn đã bị từ chối: ${profile.rejectionReason || 'Vui lòng kiểm tra lại thông tin xe.'}`,
        );
      }
      if (profile.verificationStatus === DriverVerificationStatus.SUSPENDED) {
        throw new BadRequestException(
          `Tài khoản đối tác của bạn đang bị tạm khoá: ${profile.rejectionReason || 'Vui lòng liên hệ hỗ trợ.'}`,
        );
      }
    }

    const updated = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        isOnline: dto.isOnline,
        ...(dto.latitude !== undefined ? { lastLatitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { lastLongitude: dto.longitude } : {}),
        ...(dto.latitude !== undefined && dto.longitude !== undefined ? { lastLocationAt: new Date() } : {}),
      },
    });

    return sanitizeProfile(updated);
  }

  /** Cập nhật vị trí tài xế theo chu kỳ (tối đa 1 lần mỗi 15 giây). */
  async updateLocation(userId: string, dto: UpdateDriverLocationDto): Promise<{ success: boolean }> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile || !profile.isOnline) {
      throw new BadRequestException('Tài xế đang ngoại tuyến, không thể cập nhật vị trí.');
    }

    if (profile.lastLocationAt) {
      const diffSec = (Date.now() - profile.lastLocationAt.getTime()) / 1000;
      if (diffSec < LOCATION_RATE_LIMIT_SECONDS) {
        throw new BadRequestException(
          `Cập nhật vị trí quá thường xuyên. Vui lòng chờ ít nhất ${LOCATION_RATE_LIMIT_SECONDS} giây giữa các lần cập nhật.`,
        );
      }
    }

    await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        lastLocationAt: new Date(),
      },
    });

    return { success: true };
  }

  // =========================================================================
  //  ADMIN ENDPOINTS
  // =========================================================================

  /** Admin: Xem danh sách hồ sơ tài xế kèm tài khoản người dùng */
  async adminListDrivers(query: ListDriversAdminQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const where: Prisma.DriverProfileWhereInput = {
      ...(query.status ? { verificationStatus: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              avatarUrl: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        bankAccountNumber: maskBankAccountNumber(p.bankAccountNumber),
      })),
      total,
      page,
      limit,
    };
  }

  /** Admin: Duyệt, từ chối hoặc tạm khoá hồ sơ tài xế */
  async adminVerifyDriver(userId: string, adminId: string, dto: AdminVerifyDriverDto) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ tài xế');
    }

    if (
      (dto.status === DriverVerificationStatus.REJECTED ||
        dto.status === DriverVerificationStatus.SUSPENDED) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException('Bắt buộc phải nhập lý do khi từ chối hoặc tạm khoá tài xế');
    }

    const updated = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        verificationStatus: dto.status,
        rejectionReason: dto.reason?.trim() || null,
        verifiedAt: new Date(),
        verifiedById: adminId,
        // Nếu không được duyệt thì tự động tắt trạng thái trực tuyến
        ...(dto.status !== DriverVerificationStatus.APPROVED ? { isOnline: false } : {}),
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true },
        },
      },
    });

    return sanitizeProfile(updated);
  }
}

