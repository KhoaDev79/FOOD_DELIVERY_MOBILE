import { Type } from 'class-transformer';
import { DriverVerificationStatus, VehicleType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateDriverVehicleDto {
  @IsOptional()
  @IsEnum(VehicleType, { message: 'Loại phương tiện không hợp lệ (MOTORBIKE, ELECTRIC_MOTORBIKE, BICYCLE)' })
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString({ message: 'Hãng xe phải là chuỗi ký tự' })
  vehicleBrand?: string;

  @IsOptional()
  @IsString({ message: 'Dòng xe phải là chuỗi ký tự' })
  vehicleModel?: string;

  @IsOptional()
  @IsString({ message: 'Màu xe phải là chuỗi ký tự' })
  vehicleColor?: string;

  @IsOptional()
  @IsString({ message: 'Biển số xe phải là chuỗi ký tự' })
  licensePlate?: string;

  @IsOptional()
  @IsString({ message: 'Hạng giấy phép lái xe phải là chuỗi ký tự' })
  driverLicenseClass?: string;

  @IsOptional()
  @IsString({ message: 'Tên người liên hệ khẩn cấp phải là chuỗi ký tự' })
  emergencyContactName?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại khẩn cấp phải là chuỗi ký tự' })
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString({ message: 'Tên ngân hàng phải là chuỗi ký tự' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'Số tài khoản ngân hàng phải là chuỗi ký tự' })
  bankAccountNumber?: string;

  @IsOptional()
  @IsString({ message: 'Tên chủ tài khoản ngân hàng phải là chuỗi ký tự' })
  bankAccountName?: string;
}

export class UpdateDriverStatusDto {
  @IsBoolean({ message: 'Trạng thái trực tuyến phải là giá trị đúng/sai (boolean)' })
  isOnline: boolean;

  @IsOptional()
  @IsLatitude({ message: 'Vĩ độ không hợp lệ (-90 đến 90)' })
  latitude?: number;

  @IsOptional()
  @IsLongitude({ message: 'Kinh độ không hợp lệ (-180 đến 180)' })
  longitude?: number;
}

export class UpdateDriverLocationDto {
  @IsLatitude({ message: 'Vĩ độ không hợp lệ (-90 đến 90)' })
  latitude: number;

  @IsLongitude({ message: 'Kinh độ không hợp lệ (-180 đến 180)' })
  longitude: number;
}

export class ListDriversAdminQueryDto {
  @IsOptional()
  @IsEnum(DriverVerificationStatus, { message: 'Trạng thái duyệt không hợp lệ' })
  status?: DriverVerificationStatus;

  @IsOptional()
  @IsNumber({}, { message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang phải >= 1' })
  page?: number = 1;

  @IsOptional()
  @IsNumber({}, { message: 'Giới hạn phải là số nguyên' })
  @Min(1, { message: 'Giới hạn phải >= 1' })
  limit?: number = 20;
}

export class AdminVerifyDriverDto {
  @IsEnum(DriverVerificationStatus, {
    message: 'Trạng thái xác thực không hợp lệ (APPROVED, REJECTED, SUSPENDED)',
  })
  status: DriverVerificationStatus;

  @ValidateIf((o) => o.status === DriverVerificationStatus.REJECTED || o.status === DriverVerificationStatus.SUSPENDED)
  @IsNotEmpty({ message: 'Lý do bắt buộc phải nhập khi từ chối hoặc tạm khoá hồ sơ' })
  @IsString({ message: 'Lý do phải là chuỗi ký tự' })
  reason?: string;
}

export class DriverLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class AdminDriversLedgerQueryDto extends DriverLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBalance?: number = 0;
}

export class DriverSettlementDto {
  @Type(() => Number)
  @IsInt({ message: 'Số tiền nộp phải là số nguyên (VNĐ)' })
  @Min(1000, { message: 'Số tiền nộp tối thiểu là 1.000đ' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class DriverAdjustmentDto {
  @Type(() => Number)
  @IsInt({ message: 'Số tiền điều chỉnh phải là số nguyên (VNĐ)' })
  amount: number;

  @IsString({ message: 'Ghi chú điều chỉnh là bắt buộc' })
  @MinLength(1, { message: 'Vui lòng nhập lý do điều chỉnh công nợ' })
  @MaxLength(300)
  note: string;
}

export class DriverReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class ReplyReviewDto {
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Nội dung phản hồi tối thiểu 2 ký tự' })
  @MaxLength(500, { message: 'Nội dung phản hồi tối đa 500 ký tự' })
  reply: string;
}

