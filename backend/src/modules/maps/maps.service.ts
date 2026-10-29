import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DistanceMatrixResult,
  GeocodeResult,
  IMapProvider,
  PlaceAutocompleteItem,
} from './interfaces/map-provider.interface';
import { FallbackMapProvider } from './providers/fallback-map.provider';
import { GoongMapProvider } from './providers/goong-map.provider';
import { NominatimMapProvider } from './providers/nominatim-map.provider';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private provider: IMapProvider;
  private readonly fallbackProvider = new FallbackMapProvider();
  private readonly nominatimProvider = new NominatimMapProvider();
  private readonly selectedProviderType: string;

  constructor(private readonly config: ConfigService) {
    const rawType = (this.config.get<string>('MAP_PROVIDER') || '').toLowerCase().trim();
    const goongKey = this.config.get<string>('GOONG_API_KEY')?.trim();

    if (rawType === 'goong') {
      this.selectedProviderType = 'goong';
      this.provider = new GoongMapProvider(goongKey || '');
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
      if (goongKey) {
        this.selectedProviderType = 'goong';
        this.provider = new GoongMapProvider(goongKey);
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
    try {
      return await this.provider.getDistanceMatrix(origin, destination);
    } catch (err: any) {
      this.logger.warn(`Lỗi tính cự ly qua ${this.provider.name}: ${err.message}. Chuyển sang tính Haversine dự phòng.`);
      return this.fallbackProvider.getDistanceMatrix(origin, destination);
    }
  }
}
