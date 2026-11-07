import { Controller, Get, HttpException, HttpStatus, Ip, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LruCache } from '../../common/utils/lru-cache.util';
import { MapsService } from './maps.service';

/**
 * Bộ kiểm soát tốc độ gọi API bản đồ theo từng tài khoản (Per-User Rate Limiter)
 * Dùng LruCache giới hạn kích thước (10.000 khoá) để tránh phình bộ nhớ.
 */
class UserMapRateLimiter {
  private userRequests = new LruCache<number[]>(60 * 1000, 10000);
  private readonly windowMs = 60 * 1000; // 60 giây
  private readonly maxPerWindow = 30; // Tối đa 30 request / phút / user
  /** Khách chưa đăng nhập đếm theo IP và chặt hơn, vì gói miễn phí Goong có hạn mức theo ngày */
  private readonly maxGuestPerWindow = 20;

  check(userId: string | undefined, ip = 'unknown') {
    const key = userId ? `u:${userId}` : `ip:${ip}`;
    const limit = userId ? this.maxPerWindow : this.maxGuestPerWindow;
    const now = Date.now();
    const history = this.userRequests.get(key) || [];
    const active = history.filter((t) => now - t < this.windowMs);

    if (active.length >= limit) {
      throw new HttpException(
        'Bạn đã tra cứu bản đồ quá nhiều lần trong một phút. Vui lòng chờ giây lát.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    active.push(now);
    this.userRequests.set(key, active, this.windowMs);
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

  // 3 API chọn địa chỉ công khai: khách chưa đăng nhập cũng chọn được vị trí để xem quán quanh mình
  @Public()
  @Get('reverse-geocode')
  async reverseGeocode(
    @CurrentUser('id') userId: string | undefined,
    @Ip() ip: string,
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
  ) {
    this.rateLimiter.check(userId, ip);
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

  @Public()
  @Get('autocomplete')
  async autocomplete(
    @CurrentUser('id') userId: string | undefined,
    @Ip() ip: string,
    @Query('q') query: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
  ) {
    this.rateLimiter.check(userId, ip);
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

  @Public()
  @Get('place-detail')
  async getPlaceDetail(
    @CurrentUser('id') userId: string | undefined,
    @Ip() ip: string,
    @Query('placeId') placeId: string,
  ) {
    this.rateLimiter.check(userId, ip);
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

  /** Đường đi theo đường phố (danh sách toạ độ) để vẽ lên bản đồ. */
  @Get('route')
  async getRoute(
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

    return this.mapsService.getRoute(origin, destination);
  }
}
