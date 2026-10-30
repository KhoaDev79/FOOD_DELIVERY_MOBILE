import { Type } from 'class-transformer';
import { DISCOUNT_PERCENTS } from '../menu-discount';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** VND, số nguyên */
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  price: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Mức giảm giá (%): 0, 5, 7, 10, 15 hoặc 20. Backend tự tính discountPrice từ giá. */
  @IsOptional()
  @Type(() => Number)
  @IsIn(DISCOUNT_PERCENTS)
  discountPercent?: number;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  price?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Mức giảm giá (%): 0, 5, 7, 10, 15 hoặc 20. Backend tự tính discountPrice từ giá. */
  @IsOptional()
  @Type(() => Number)
  @IsIn(DISCOUNT_PERCENTS)
  discountPercent?: number;
}
