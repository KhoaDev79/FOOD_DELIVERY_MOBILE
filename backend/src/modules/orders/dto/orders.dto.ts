import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CancelReason, ChatChannel, FailedDeliveryReason, OrderStatus } from '@prisma/client';

/** Client gửi ID, số lượng và mã tuỳ chọn. Giá luôn được tra cứu lại từ DB. */
export class OrderItemInputDto {
  @IsUUID()
  menuItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  /** Mã size theo tuỳ chọn của món (bỏ trống = size mặc định). Giá do server tra cứu. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sizeId?: string;

  /** Mã topping theo tuỳ chọn của món. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  toppingIds?: string[];

  /** Mức cay/đường theo tuỳ chọn của món. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;
}

export class QuoteOrderDto {
  @IsUUID()
  restaurantId: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: OrderItemInputDto[];

  /** Bắt buộc dùng địa chỉ đã lưu trong sổ địa chỉ của khách */
  @IsUUID()
  addressId: string;
}

export class CreateOrderDto extends QuoteOrderDto {
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  quoteToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsEnum(CancelReason)
  cancelReason?: CancelReason;

  @IsOptional()
  @IsEnum(FailedDeliveryReason)
  failedReason?: FailedDeliveryReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelNote?: string;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

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

export class ReviewOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  driverRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  driverComment?: string;
}

export class ReleaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;
}

export class DriverArrivedDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

/** Phân trang hộp thư tin nhắn. */
export class ConversationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang bắt đầu từ 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(50, { message: 'Mỗi trang tối đa 50 cuộc trò chuyện' })
  limit: number = 30;
}

/** Cuộc trò chuyện trong đơn: khách–tài xế, khách–quán hoặc quán–tài xế. */
export class ChatChannelDto {
  @IsEnum(ChatChannel, { message: 'Cuộc trò chuyện không hợp lệ' })
  channel: ChatChannel;
}

export class SendOrderMessageDto extends ChatChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
