import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DriverProfile,
  DriverVerificationStatus,
  LedgerEntryType,
  Prisma,
  Role,
  VehicleType,
} from '@prisma/client';
import {
  isValidVietnameseLicensePlate,
  maskBankAccountNumber,
  normalizeLicensePlate,
} from '../../common/utils/vietnamese-plate.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminDriversLedgerQueryDto,
  AdminVerifyDriverDto,
  DriverAdjustmentDto,
  DriverLedgerQueryDto,
  DriverSettlementDto,
  ListDriversAdminQueryDto,
  UpdateDriverLocationDto,
  UpdateDriverStatusDto,
  UpdateDriverVehicleDto,
} from './dto/drivers.dto';

const LOCATION_RATE_LIMIT_SECONDS = 15;

export type SanitizedDriverProfile = Omit<DriverProfile, 'bankAccountNumber'> & {
  bankAccountNumber: string | null;
  maskedBankAccountNumber: string | null;
  ratingAvg?: number;
  ratingCount?: number;
};

function sanitizeProfile(
  profile: DriverProfile,
  ratingStats?: { ratingAvg: number; ratingCount: number },
): SanitizedDriverProfile {
  return {
    ...profile,
    bankAccountNumber: maskBankAccountNumber(profile.bankAccountNumber),
    maskedBankAccountNumber: maskBankAccountNumber(profile.bankAccountNumber),
    ...(ratingStats ? ratingStats : {}),
  };
}

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private getDebtLimit(): number {
    return Number(this.config?.get<number>('business.driverDebtLimit') ?? 2000000);
  }

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

    const ratingStats = await this.getDriverRatingStats(userId);
    return sanitizeProfile(profile, ratingStats);
  }

  private async getDriverRatingStats(userId: string): Promise<{ ratingAvg: number; ratingCount: number }> {
    try {
      const agg = await (this.prisma as any).review?.aggregate?.({
        where: {
          driverId: userId,
          driverRating: { not: null },
          isHidden: false,
        },
        _avg: { driverRating: true },
        _count: { driverRating: true },
      });
      const count = agg?._count?.driverRating ?? 0;
      const avg = count > 0 ? Math.round((agg?._avg?.driverRating ?? 0) * 10) / 10 : 0;
      return { ratingAvg: avg, ratingCount: count };
    } catch {
      return { ratingAvg: 0, ratingCount: 0 };
    }
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
      if (typeof dto.latitude !== 'number' || typeof dto.longitude !== 'number') {
        throw new BadRequestException(
          'Vui lòng bật định vị và gửi toạ độ hiện tại khi chuyển sang trực tuyến.',
        );
      }
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
  //  CÔNG NỢ COD (DRIVER LEDGER) — C4
  // =========================================================================

  /** Tài xế xem sổ quỹ COD và hạn mức công nợ của mình */
  async getMyLedger(userId: string, query: DriverLedgerQueryDto) {
    const profile = await this.getMe(userId);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const rows = await this.prisma.driverLedger.findMany({
      where: { driverId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });

    return {
      balance: profile.codBalance,
      limit: this.getDebtLimit(),
      items: rows.slice(0, limit),
      page,
      pageSize: limit,
      hasMore: rows.length > limit,
    };
  }

  /** Admin: Danh sách tài xế kèm số dư công nợ COD (sắp giảm dần) */
  async adminListDriverLedgers(query: AdminDriversLedgerQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const minBalance = Number(query.minBalance) || 0;

    const where: Prisma.DriverProfileWhereInput =
      minBalance > 0 ? { codBalance: { gte: minBalance } } : {};

    const [profiles, total, agg] = await Promise.all([
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
            },
          },
        },
        orderBy: [{ codBalance: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driverProfile.count({ where }),
      this.prisma.driverProfile.aggregate({
        _sum: { codBalance: true },
      }),
    ]);

    return {
      items: profiles.map((p) => sanitizeProfile(p)),
      total,
      page,
      limit,
      debtLimit: this.getDebtLimit(),
      totalDebt: agg._sum.codBalance ?? 0,
    };
  }

  /** Admin: Xem chi tiết sổ quỹ COD của 1 tài xế */
  async adminGetDriverLedger(driverUserId: string, query: DriverLedgerQueryDto) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ tài xế');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const rows = await this.prisma.driverLedger.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });

    return {
      driver: profile.user,
      balance: profile.codBalance,
      limit: this.getDebtLimit(),
      items: rows.slice(0, limit),
      page,
      pageSize: limit,
      hasMore: rows.length > limit,
    };
  }

  /** Admin: Ghi nhận tài xế nộp tiền mặt về công ty (SETTLEMENT) */
  async adminRecordSettlement(driverUserId: string, adminId: string, dto: DriverSettlementDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền nộp phải lớn hơn 0');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "driver_profiles" WHERE "userId" = ${driverUserId}::uuid FOR UPDATE`;
      const profile = await tx.driverProfile.findUnique({ where: { userId: driverUserId } });
      if (!profile) {
        throw new NotFoundException('Không tìm thấy hồ sơ tài xế');
      }
      if (dto.amount > profile.codBalance) {
        throw new BadRequestException(
          `Số tiền nộp (${dto.amount.toLocaleString('vi-VN')}đ) vượt quá công nợ hiện tại (${profile.codBalance.toLocaleString('vi-VN')}đ)`,
        );
      }

      const updatedProfile = await tx.driverProfile.update({
        where: { userId: driverUserId },
        data: { codBalance: { decrement: dto.amount } },
      });

      const entry = await tx.driverLedger.create({
        data: {
          driverId: driverUserId,
          type: LedgerEntryType.SETTLEMENT,
          amount: -dto.amount,
          balanceAfter: updatedProfile.codBalance,
          note: dto.note?.trim() || 'Tài xế nộp tiền thu hộ COD',
          createdById: adminId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DRIVER_SETTLEMENT',
          targetType: 'DRIVER',
          targetId: profile.id,
          metadata: {
            driverId: driverUserId,
            amount: dto.amount,
            previousBalance: profile.codBalance,
            balanceAfter: updatedProfile.codBalance,
            note: dto.note?.trim() || null,
          },
        },
      });

      return {
        entry,
        balance: updatedProfile.codBalance,
        limit: this.getDebtLimit(),
      };
    });
  }

  /** Admin: Điều chỉnh công nợ COD thủ công (+/-) kèm lý do bắt buộc */
  async adminRecordAdjustment(driverUserId: string, adminId: string, dto: DriverAdjustmentDto) {
    if (!dto.amount || dto.amount === 0) {
      throw new BadRequestException('Số tiền điều chỉnh phải khác 0');
    }
    const cleanNote = dto.note?.trim();
    if (!cleanNote) {
      throw new BadRequestException('Ghi chú điều chỉnh là bắt buộc');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "driver_profiles" WHERE "userId" = ${driverUserId}::uuid FOR UPDATE`;
      const profile = await tx.driverProfile.findUnique({ where: { userId: driverUserId } });
      if (!profile) {
        throw new NotFoundException('Không tìm thấy hồ sơ tài xế');
      }

      const updatedProfile = await tx.driverProfile.update({
        where: { userId: driverUserId },
        data: { codBalance: { increment: dto.amount } },
      });

      const entry = await tx.driverLedger.create({
        data: {
          driverId: driverUserId,
          type: LedgerEntryType.ADJUSTMENT,
          amount: dto.amount,
          balanceAfter: updatedProfile.codBalance,
          note: cleanNote,
          createdById: adminId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DRIVER_LEDGER_ADJUSTMENT',
          targetType: 'DRIVER',
          targetId: profile.id,
          metadata: {
            driverId: driverUserId,
            amount: dto.amount,
            previousBalance: profile.codBalance,
            balanceAfter: updatedProfile.codBalance,
            note: cleanNote,
          },
        },
      });

      return {
        entry,
        balance: updatedProfile.codBalance,
        limit: this.getDebtLimit(),
      };
    });
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

    const enriched = await Promise.all(
      items.map(async (p) => {
        const stats = await this.getDriverRatingStats(p.userId);
        return {
          ...p,
          bankAccountNumber: maskBankAccountNumber(p.bankAccountNumber),
          ratingAvg: stats.ratingAvg,
          ratingCount: stats.ratingCount,
        };
      }),
    );

    return {
      items: enriched,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.driverProfile.update({
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
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `DRIVER_VERIFY_${dto.status}`,
          targetType: 'DRIVER',
          targetId: profile.id,
          metadata: {
            userId,
            previousStatus: profile.verificationStatus,
            reason: dto.reason?.trim() || null,
          },
        },
      });
      return res;
    });

    return sanitizeProfile(updated);
  }
}
