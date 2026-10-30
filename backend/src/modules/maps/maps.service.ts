import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineKm } from '../../common/utils/geo.util';
import { LruCache } from '../../common/utils/lru-cache.util';
import {
  DistanceMatrixResult,
  GeocodeResult,
  IMapProvider,
  PlaceAutocompleteItem,
} from './interfaces/map-provider.interface';
import { FallbackMapProvider } from './providers/fallback-map.provider';
import { GoongMapProvider } from './providers/goong-map.provider';
import { NominatimMapProvider } from './providers/nominatim-map.provider';

export interface RoadDistanceResult {
  distanceKm: number;
  durationMinutes: number;
  source: 'ROAD' | 'ESTIMATED';
}

const ROAD_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ cho kết quả ROAD
const ESTIMATED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút cho kết quả ESTIMATED để tự hồi phục khi Goong hoạt động lại

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private provider: IMapProvider;
  private readonly fallbackProvider: FallbackMapProvider;
  private readonly nominatimProvider: NominatimMapProvider;
  private readonly goongProvider: GoongMapProvider | null;
  private readonly selectedProviderType: string;
  private readonly fallbackFactor: number;
  private readonly roadDistanceCache = new LruCache<RoadDistanceResult>(ROAD_CACHE_TTL_MS, 10000);

  constructor(private readonly config: ConfigService) {
    const rawType = (this.config.get<string>('MAP_PROVIDER') || '').toLowerCase().trim();
    const goongKey = this.config.get<string>('GOONG_API_KEY')?.trim();
    this.fallbackFactor =
      Number(this.config.get<number>('business.roadDistanceFallbackFactor')) ||
      Number(this.config.get<string>('ROAD_DISTANCE_FALLBACK_FACTOR')) ||
      1.3;

    this.fallbackProvider = new FallbackMapProvider(this.fallbackFactor);
    this.nominatimProvider = new NominatimMapProvider(this.fallbackFactor);
    this.goongProvider = goongKey ? new GoongMapProvider(goongKey) : null;

    if (rawType === 'goong') {
      this.selectedProviderType = 'goong';
      this.provider = this.goongProvider ?? new GoongMapProvider('');
      this.logger.log('Khởi tạo dịch vụ bản đồ: Goong Map Provider.');
    } else if (rawType === 'nominatim') {
      this.selectedProviderType = 'nominatim';
      this.provider = this.nominatimProvider;
      this.logger.log('Khởi tạo dịch vụ bản đồ: Nominatim Map Provider (Development).');
    } else if (rawType === 'fallback') {
      this.selectedProviderType = 'fallback';
      this.provider = this.fallbackProvider;
      this.logger.log('Khởi tạo dịch vụ bản đồ: Fallback Heuristic Provider (Offline-safe).');
    } else {
      // Mặc định tự động chọn: có key Goong thì dùng Goong, chưa có key thì dùng Nominatim
      if (this.goongProvider) {
        this.selectedProviderType = 'goong';
        this.provider = this.goongProvider;
        this.logger.log('Tự động chọn Goong Map Provider do đã có GOONG_API_KEY.');
      } else {
        this.selectedProviderType = 'nominatim';
        this.provider = this.nominatimProvider;
        this.logger.log('Chưa cấu hình GOONG_API_KEY, tự động chọn Nominatim Map Provider.');
      }
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  getProviderType(): string {
    return this.selectedProviderType;
  }

  setProvider(newProvider: IMapProvider) {
    this.provider = newProvider;
    this.logger.log(`Đã chuyển đổi Map Provider sang: ${newProvider.name}`);
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    try {
      return await this.provider.reverseGeocode(lat, lng);
    } catch (err: any) {
      this.logger.error(
        `[MAPS ERROR] Nhà cung cấp [${this.provider.name}] thất bại khi gọi reverseGeocode(${lat}, ${lng}): ${err.message}. Hệ thống KHÔNG tự động chuyển provider ngầm theo đúng cấu hình MAP_PROVIDER.`,
      );
      throw new Error(err.message || 'Không thể xác định tên đường tại vị trí này.');
    }
  }

  async searchPlaces(query: string, lat?: number, lng?: number): Promise<PlaceAutocompleteItem[]> {
    try {
      return await this.provider.searchPlaces(query, lat, lng);
    } catch (err: any) {
      this.logger.warn(`Lỗi khi tìm kiếm qua ${this.provider.name}: ${err.message}`);
      return [];
    }
  }

  async getPlaceDetail(placeId: string): Promise<GeocodeResult | null> {
    try {
      return await this.provider.getPlaceDetail(placeId);
    } catch (err: any) {
      this.logger.warn(`Lỗi khi lấy chi tiết qua ${this.provider.name}: ${err.message}`);
      return null;
    }
  }

  async getDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<DistanceMatrixResult> {
    const res = await this.getRoadDistance(origin, destination);
    return { distanceKm: res.distanceKm, durationMinutes: res.durationMinutes };
  }

  /**
   * Tính khoảng cách đường bộ:
   * - Làm tròn toạ độ hai đầu 3 chữ số thập phân làm khoá cache LRU.
   * - Gọi Goong DistanceMatrix (vehicle=bike) khi có GOONG_API_KEY -> source = 'ROAD', cache 24 giờ.
   * - Nếu Goong lỗi / hết quota / chưa có key -> Haversine x ROAD_DISTANCE_FALLBACK_FACTOR -> source = 'ESTIMATED', cache 5 phút.
   */
  async getRoadDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RoadDistanceResult> {
    const cacheKey = `${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}->${destination.lat.toFixed(3)}_${destination.lng.toFixed(3)}`;
    const cached = this.roadDistanceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.goongProvider) {
      try {
        const res = await this.goongProvider.getDistanceMatrix(origin, destination);
        const roadResult: RoadDistanceResult = {
          distanceKm: res.distanceKm,
          durationMinutes: res.durationMinutes,
          source: 'ROAD',
        };
        this.roadDistanceCache.set(cacheKey, roadResult, ROAD_CACHE_TTL_MS);
        return roadResult;
      } catch (err: any) {
        const safeMsg = String(err?.message || 'Lỗi không xác định').replace(/api_key=[^&\s]+/gi, 'api_key=***');
        this.logger.warn(
          `Goong DistanceMatrix lỗi (${safeMsg}), chuyển sang Haversine x ${this.fallbackFactor} (ESTIMATED).`,
        );
      }
    } else {
      this.logger.warn(
        `Chưa cấu hình GOONG_API_KEY, dùng Haversine x ${this.fallbackFactor} (ESTIMATED) cho khoảng cách đường bộ.`,
      );
    }

    const directKm = haversineKm(origin, destination);
    const distanceKm = Math.max(0.5, Math.round(directKm * this.fallbackFactor * 10) / 10);
    const durationMinutes = Math.max(5, Math.round(distanceKm * 2.5 + 8));
    const estimatedResult: RoadDistanceResult = {
      distanceKm,
      durationMinutes,
      source: 'ESTIMATED',
    };
    this.roadDistanceCache.set(cacheKey, estimatedResult, ESTIMATED_CACHE_TTL_MS);
    return estimatedResult;
  }
}
