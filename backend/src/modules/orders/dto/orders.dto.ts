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
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentMethod } from '@prisma/client';

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

export class CreateOrderDto {
  @IsUUID()
  restaurantId: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: OrderItemInputDto[];

  /** Dùng địa chỉ đã lưu ... */
  @IsOptional()
  @IsUUID()
  addressId?: string;

  /** ... hoặc gửi địa chỉ ghim trực tiếp trên bản đồ */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  deliveryLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  deliveryLng?: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.COD;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
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
}
