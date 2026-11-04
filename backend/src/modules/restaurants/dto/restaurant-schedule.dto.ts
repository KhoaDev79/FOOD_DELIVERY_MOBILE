import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateWeeklyScheduleItemDto {
  /** 0 = Chủ nhật, 1 = Thứ hai, 2 = Thứ ba, ..., 6 = Thứ bảy */
  @IsInt({ message: 'dayOfWeek phải là số từ 0 đến 6' })
  @Min(0, { message: 'dayOfWeek tối thiểu là 0 (Chủ nhật)' })
  @Max(6, { message: 'dayOfWeek tối đa là 6 (Thứ bảy)' })
  dayOfWeek: number;

  @Matches(TIME_HHMM, { message: 'openTime phải có định dạng HH:mm (ví dụ 07:00)' })
  openTime: string;

  @Matches(TIME_HHMM, { message: 'closeTime phải có định dạng HH:mm (ví dụ 22:00)' })
  closeTime: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean = false;
}

export class UpdateWeeklyScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWeeklyScheduleItemDto)
  schedule: UpdateWeeklyScheduleItemDto[];

  /** Nếu true, lấy cấu hình của ngày đầu tiên trong mảng áp dụng cho cả 7 ngày */
  @IsOptional()
  @IsBoolean()
  applyToAllDays?: boolean;
}

export class CreateSpecialClosingDto {
  /** Ngày nghỉ theo định dạng YYYY-MM-DD */
  @IsNotEmpty({ message: 'Ngày nghỉ không được để trống' })
  @IsDateString({}, { message: 'date phải là ngày hợp lệ (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date phải có dạng YYYY-MM-DD' })
  date: string;

  /** Lý do nghỉ (ví dụ: Nghỉ Tết Nguyên Đán, Đám cưới...) */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Lý do tối đa 200 ký tự' })
  reason?: string;
}

