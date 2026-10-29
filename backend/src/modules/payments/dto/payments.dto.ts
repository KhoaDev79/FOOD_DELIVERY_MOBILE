import { IsOptional, IsString } from 'class-validator';

export class CreatePaymentUrlDto {
  @IsOptional()
  @IsString()
  bankCode?: string;
}

