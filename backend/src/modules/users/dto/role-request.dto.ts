import { Role, VehicleType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Khách hàng xin nâng cấp thành Chủ quán hoặc Tài xế. */
export class CreateRoleRequestDto {
  @IsIn([Role.RESTAURANT_OWNER, Role.DRIVER], { message: 'Chỉ có thể đăng ký làm Chủ quán hoặc Tài xế' })
  requestedRole: Role;

  // ---- Chủ quán ----
  @ValidateIf((o: CreateRoleRequestDto) => o.requestedRole === Role.RESTAURANT_OWNER)
  @IsString({ message: 'Vui lòng nhập tên quán dự kiến' })
  @MaxLength(120)
  restaurantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  restaurantAddress?: string;

  // ---- Tài xế ----
  @ValidateIf((o: CreateRoleRequestDto) => o.requestedRole === Role.DRIVER)
  @IsEnum(VehicleType, { message: 'Loại xe không hợp lệ' })
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  vehicleBrand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  licensePlate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
