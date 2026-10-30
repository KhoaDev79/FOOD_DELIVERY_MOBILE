import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Role, RoleRequestStatus } from '@prisma/client';

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

  @IsString()
  phone: string;

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

export enum RestaurantFilter {
  ALL = 'all',
  OPEN = 'open',
  CLOSED = 'closed',
  UNASSIGNED = 'unassigned',
}

export class ListAdminRestaurantsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(RestaurantFilter)
  filter?: RestaurantFilter;

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
