import { STOCK_STATUSES, StockStatus } from '../menu-stock.util';
import { Transform, Type } from 'class-transformer';
import { DISCOUNT_PERCENTS } from '../menu-discount';
import { MAX_LEVELS, MAX_OPTION_PRICE, MAX_SIZES, MAX_TOPPINGS } from '../menu-options';
import {
  ArrayMaxSize,
  IsArray,
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
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Một lựa chọn có giá (size hoặc topping). id chỉ gửi khi sửa lựa chọn đã có. */
export class MenuOptionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @MinLength(1, { message: 'Tên lựa chọn không được để trống' })
  @MaxLength(60, { message: 'Tên lựa chọn tối đa 60 ký tự' })
  name: string;

  /** Giá cộng thêm (VND), 0 = miễn phí */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_OPTION_PRICE, { message: 'Giá cộng thêm tối đa 500.000 ₫' })
  price: number;
}

/** Tuỳ chọn của món: size, topping và một loại mức (cay hoặc đường). Gửi null để xoá hết. */
export class MenuItemOptionsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SIZES, { message: 'Tối đa 10 size' })
  @ValidateNested({ each: true })
  @Type(() => MenuOptionInputDto)
  sizes?: MenuOptionInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TOPPINGS, { message: 'Tối đa 10 topping' })
  @ValidateNested({ each: true })
  @Type(() => MenuOptionInputDto)
  toppings?: MenuOptionInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LEVELS, { message: 'Tối đa 6 mức' })
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  spiceLevels?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LEVELS, { message: 'Tối đa 6 mức' })
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  sugarLevels?: string[];
}

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

  /** Size / topping / mức cay hoặc mức đường. null = xoá hết tuỳ chọn; bỏ trống = giữ nguyên. */
  @IsOptional()
  @ValidateNested()
  @Type(() => MenuItemOptionsDto)
  options?: MenuItemOptionsDto | null;

  /** Khung giờ bán từ HH:mm (null = bán suốt giờ mở cửa) */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(TIME_HHMM, { message: 'Giờ bắt đầu bán phải có định dạng HH:mm' })
  availableFrom?: string | null;

  /** Khung giờ bán đến HH:mm */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(TIME_HHMM, { message: 'Giờ kết thúc bán phải có định dạng HH:mm' })
  availableTo?: string | null;
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

  /** Size / topping / mức cay hoặc mức đường. null = xoá hết tuỳ chọn; bỏ trống = giữ nguyên. */
  @IsOptional()
  @ValidateNested()
  @Type(() => MenuItemOptionsDto)
  options?: MenuItemOptionsDto | null;

  /** Khung giờ bán từ HH:mm (null = bán suốt giờ mở cửa) */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(TIME_HHMM, { message: 'Giờ bắt đầu bán phải có định dạng HH:mm' })
  availableFrom?: string | null;

  /** Khung giờ bán đến HH:mm */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(TIME_HHMM, { message: 'Giờ kết thúc bán phải có định dạng HH:mm' })
  availableTo?: string | null;
}

/** Đổi tình trạng món: còn hàng / hết hôm nay (tự mở lại 04:00 sáng mai) / hết đến khi bật lại. */
export class UpdateMenuItemStockDto {
  @IsIn(STOCK_STATUSES, { message: 'Tình trạng món không hợp lệ' })
  status: StockStatus;
}
