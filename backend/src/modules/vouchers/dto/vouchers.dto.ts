import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VoucherType } from '@prisma/client';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AvailableVouchersQueryDto {
  @IsUUID()
  restaurantId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotal: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryFee?: number = 0;
}

export class WalletQueryDto {
  @IsOptional()
  @IsIn(['available', 'history'])
  tab?: 'available' | 'history' = 'available';
}

export class CreateVoucherDto {
  @Transform(upper)
  @Matches(/^[A-Z0-9]{4,20}$/, { message: 'Mã gồm 4–20 chữ cái in hoa hoặc số, không dấu, không khoảng trắng' })
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsEnum(VoucherType)
  discountType: VoucherType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  discountValue: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmount?: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUsage: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perUserLimit?: number = 1;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsISO8601()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  onlyNewCustomer?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  /** Chỉ admin: giới hạn mã cho một quán (sàn vẫn chịu chi phí) */
  @IsOptional()
  @IsUUID()
  restaurantId?: string;
}

export class UpdateVoucherDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  discountValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUsage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  onlyNewCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListVouchersQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'expired', 'all'])
  status?: 'active' | 'inactive' | 'expired' | 'all' = 'all';

  @IsOptional()
  @IsIn(['CAMPAIGN', 'COMPENSATION'])
  kind?: 'CAMPAIGN' | 'COMPENSATION';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  q?: string;
}

export class CompensateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(500_000)
  amount: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}
