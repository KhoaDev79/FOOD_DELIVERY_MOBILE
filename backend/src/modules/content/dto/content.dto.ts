import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BANNER_ACTIONS } from '../content-rules';

export class UploadImageDto {
  /** Ảnh dạng data URI base64 (JPG/PNG/WebP, tối đa 5 MB). */
  @IsString()
  @MaxLength(7_500_000)
  dataUri: string;

  @IsIn(['banners', 'cuisines'])
  folder: 'banners' | 'cuisines';
}

export class CreateBannerDto {
  @IsString()
  @MinLength(2, { message: 'Tiêu đề tối thiểu 2 ký tự' })
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng chọn ảnh banner' })
  @MaxLength(1000)
  imageUrl: string;

  @IsOptional()
  @IsIn(BANNER_ACTIONS as unknown as string[])
  actionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actionValue?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** ISO 8601; null = không giới hạn */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  endAt?: string | null;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsIn(BANNER_ACTIONS as unknown as string[])
  actionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actionValue?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  endAt?: string | null;
}

export class CreateCuisineDto {
  @IsString()
  @MinLength(2, { message: 'Tên danh mục tối thiểu 2 ký tự' })
  @MaxLength(40)
  name: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng chọn ảnh danh mục' })
  @MaxLength(1000)
  imageUrl: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCuisineDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Thứ tự mới: danh sách id từ trên xuống dưới. */
export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  @Type(() => String)
  ids: string[];
}
