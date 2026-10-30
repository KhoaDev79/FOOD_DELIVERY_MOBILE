import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { BusinessConfig } from './configuration';

@Controller('config')
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  /** Cấu hình công khai không nhạy cảm để mobile hiển thị (bán kính, hạn mức, thời gian chờ...). */
  @Public()
  @Get('public')
  getPublicConfig() {
    const biz = this.config.getOrThrow<BusinessConfig>('business');
    return {
      deliveryBaseFee: biz.deliveryBaseFee,
      deliveryFeePerKm: biz.deliveryFeePerKm,
      deliveryFreeKm: biz.deliveryFreeKm,
      deliveryPeakMultiplier: biz.deliveryPeakMultiplier,
      deliveryPeakWindowsRaw: biz.deliveryPeakWindowsRaw,
      quoteTtlMinutes: biz.quoteTtlMinutes,
      platformCommissionRate: biz.platformCommissionRate,
      driverDebtLimit: biz.driverDebtLimit,
      driverSearchRadiusKm: biz.driverSearchRadiusKm,
      maxActiveDeliveries: biz.maxActiveDeliveries,
      failedDeliveryMinWaitMinutes: biz.failedDeliveryMinWaitMinutes,
      failedDeliveryMinCalls: biz.failedDeliveryMinCalls,
      arrivalMaxDistanceM: biz.arrivalMaxDistanceM,
      reviewWindowDays: biz.reviewWindowDays,
    };
  }
}

