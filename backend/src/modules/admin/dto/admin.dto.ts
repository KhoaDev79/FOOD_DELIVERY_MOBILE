import { RestaurantStatus, Role, RoleRequestStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class ListAdminOrdersQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  stalled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class AdminCreateRestaurantDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @Type(() => Number)
  latitude: number;

  @Type(() => Number)
  longitude: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  ownerName: string;

  @IsString()
  ownerPhone: string;

  @IsString()
  ownerEmail: string;
}

export class AdminUpdateRestaurantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  isOpen?: boolean;
}

export class RejectRestaurantDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MinLength(2, { message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(500)
  reason: string;
}

export class UpdateRestaurantStatusDto {
  @IsIn([RestaurantStatus.ACTIVE, RestaurantStatus.SUSPENDED])
  status: 'ACTIVE' | 'SUSPENDED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export enum RestaurantFilter {
  ALL = 'all',
  OPEN = 'open',
  CLOSED = 'closed',
  UNASSIGNED = 'unassigned',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export class ListAdminRestaurantsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(RestaurantFilter)
  filter?: RestaurantFilter;

  @IsOptional()
  @IsEnum(RestaurantStatus)
  status?: RestaurantStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class AssignOwnerDto {
  @IsUUID()
  ownerId: string;
}

export class ToggleUserActiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ChangeUserRoleDto {
  @IsEnum(Role)
  role: Role;
}

export class ListRoleRequestsQueryDto {
  @IsOptional()
  @IsEnum(RoleRequestStatus)
  status?: RoleRequestStatus;
}

export class ReviewRoleRequestDto {
  @IsIn([RoleRequestStatus.APPROVED, RoleRequestStatus.REJECTED])
  status: RoleRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reviewNote?: string;
}

export class UpdateReviewVisibilityDto {
  @IsBoolean()
  isHidden: boolean;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do ẩn/hiện đánh giá' })
  @MaxLength(500)
  reason: string;
}

export class UnassignDriverDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
