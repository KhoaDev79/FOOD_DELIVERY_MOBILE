import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Giờ dạng HH:mm, 00:00 – 23:59. */
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class NearbyRestaurantsQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  /** Bán kính tìm kiếm (km), tối đa 30km */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(30)
  radiusKm: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  openOnly: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Giống ảnh món (menus.dto): nhận đường dẫn tương đối "/public/..." của dữ liệu mẫu và ảnh
  // base64 chọn từ máy. @IsUrl cũ từ chối cả hai nên lưu thông tin quán luôn lỗi.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MaxLength(255)
  address: string;

  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(30)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Giống ảnh món (menus.dto): nhận đường dẫn tương đối "/public/..." của dữ liệu mẫu và ảnh
  // base64 chọn từ máy. @IsUrl cũ từ chối cả hai nên lưu thông tin quán luôn lỗi.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(30)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @Matches(TIME_HHMM, { message: 'Giờ mở cửa phải có dạng HH:mm' })
  openTime?: string;

  @IsOptional()
  @Matches(TIME_HHMM, { message: 'Giờ đóng cửa phải có dạng HH:mm' })
  closeTime?: string;
}
