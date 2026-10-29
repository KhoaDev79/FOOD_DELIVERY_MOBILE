import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MapsService } from './maps.service';

/**
 * Bộ kiểm soát tốc độ gọi API bản đồ theo từng tài khoản (Per-User Rate Limiter)
 * Ngăn chặn một cá nhân gửi quá nhiều request gây cạn kiệt hạn mức 1.000 req/ngày của hệ thống.
 */
class UserMapRateLimiter {
  private userRequests = new Map<string, number[]>();
  private readonly windowMs = 60 * 1000; // 60 giây
  private readonly maxPerWindow = 30; // Tối đa 30 request / phút / user

  check(userId: string) {
    const now = Date.now();
    const history = this.userRequests.get(userId) || [];
    const active = history.filter((t) => now - t < this.windowMs);

    if (active.length >= this.maxPerWindow) {
      throw new HttpException(
        'Bạn đã gửi quá nhiều yêu cầu tra cứu bản đồ (vượt hạn mức 30 yêu cầu/phút). Vui lòng chờ giây lát.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    active.push(now);
    this.userRequests.set(userId, active);
  }
}

@Controller('maps')
export class MapsController {
  private readonly rateLimiter = new UserMapRateLimiter();

  constructor(private readonly mapsService: MapsService) {}

  @Public()
  @Get('info')
  getMapInfo() {
    return {
      provider: this.mapsService.getProviderName(),
      providerType: this.mapsService.getProviderType(),
      status: 'active',
      supportsManualInput: true,
      dailyQuotaStandard: '1.000 yêu cầu / ngày theo bảng điều khiển Goong Console',
    };
  }

  @Get('reverse-geocode')
  async reverseGeocode(
    @CurrentUser('id') userId: string,
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
  ) {
    this.rateLimiter.check(userId);
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) {
      throw new HttpException(
        'Tọa độ lat/lng không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.mapsService.reverseGeocode(lat, lng);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Không thể xác định địa chỉ từ toạ độ này. Bạn có thể tự gõ địa chỉ thủ công.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('autocomplete')
  async autocomplete(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
  ) {
    this.rateLimiter.check(userId);
    if (!query || !query.trim()) return [];
    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lngStr ? parseFloat(lngStr) : undefined;
    try {
      return await this.mapsService.searchPlaces(query, lat, lng);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Lỗi khi tìm kiếm địa điểm.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('place-detail')
  async getPlaceDetail(
    @CurrentUser('id') userId: string,
    @Query('placeId') placeId: string,
  ) {
    this.rateLimiter.check(userId);
    if (!placeId) return null;
    return this.mapsService.getPlaceDetail(placeId);
  }

  @Get('distance')
  async getDistance(
    @CurrentUser('id') userId: string,
    @Query('originLat') originLatStr: string,
    @Query('originLng') originLngStr: string,
    @Query('destLat') destLatStr: string,
    @Query('destLng') destLngStr: string,
  ) {
    this.rateLimiter.check(userId);
    const origin = { lat: parseFloat(originLatStr), lng: parseFloat(originLngStr) };
    const destination = { lat: parseFloat(destLatStr), lng: parseFloat(destLngStr) };

    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
      throw new HttpException('Tọa độ không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    return this.mapsService.getDistance(origin, destination);
  }
}
