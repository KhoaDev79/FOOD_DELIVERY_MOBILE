import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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
  ValidateIf,
} from 'class-validator';
import { SEARCH_SORTS, SearchSort } from '../search-filters';

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

  /** Sắp xếp: phù hợp nhất (mặc định) | gần nhất | đánh giá cao | phổ biến */
  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: SearchSort;

  /** Chỉ quán có điểm đánh giá từ mức này (vd 4, 4.5) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  /** Khoảng cách tối đa (km) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(30)
  maxDistanceKm?: number;

  /** Phí ship ước tính tối đa (đồng) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500_000)
  maxDeliveryFee?: number;

  /** Chỉ quán đang có mã giảm giá của quán hoặc món giảm giá */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasPromo: boolean = false;

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

  /** Mốc tạm nghỉ có hẹn giờ (chuỗi ISO hoặc null để huỷ tạm nghỉ). */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsDateString({}, { message: 'pausedUntil phải là chuỗi ngày giờ hợp lệ hoặc null' })
  pausedUntil?: string | null;

  /** Chế độ hẹn giờ nhanh: 30 phút, 1 giờ, 2 giờ, đến hết hôm nay, hoặc huỷ tạm nghỉ */
  @IsOptional()
  @IsIn(['30m', '1h', '2h', 'today', 'cancel'])
  pauseMode?: '30m' | '1h' | '2h' | 'today' | 'cancel';
}

export class ListRestaurantReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unrepliedOnly?: boolean;

  /** Chỉ đánh giá có ảnh */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  withPhotos?: boolean;
}

export const REVIEW_IMAGE_HIDE_REASONS = ['IRRELEVANT', 'OFFENSIVE', 'PERSONAL_INFO', 'SPAM'] as const;

export class HideReviewImageDto {
  @IsString()
  @MaxLength(1000)
  imageUrl: string;

  /** Không liên quan món ăn | phản cảm | lộ thông tin cá nhân | quảng cáo / spam */
  @IsIn(REVIEW_IMAGE_HIDE_REASONS)
  reason: (typeof REVIEW_IMAGE_HIDE_REASONS)[number];
}

export class UnhideReviewImageDto {
  @IsString()
  @MaxLength(1000)
  imageUrl: string;
}

export class ReplyReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reply: string;
}
