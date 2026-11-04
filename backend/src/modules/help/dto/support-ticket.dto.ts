import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';

export class AffectedItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateSupportTicketDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffectedItemDto)
  affectedItems?: AffectedItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Tối đa 3 hình ảnh đính kèm' })
  @IsString({ each: true })
  attachments?: string[];
}

export class CreateTicketMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class SubmitCsatDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  csatScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  csatComment?: string;
}

export class ListTicketsQueryDto {
  @IsOptional()
  @IsString()
  statusGroup?: 'open' | 'closed' | 'all';

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class SendBotMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Tin nhắn cho trợ lý tối đa 500 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class BotFeedbackDto {
  @IsEnum(['HELPFUL', 'UNHELPFUL'])
  feedback: 'HELPFUL' | 'UNHELPFUL';
}


export class BotHandoverDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  summary?: string;
}
