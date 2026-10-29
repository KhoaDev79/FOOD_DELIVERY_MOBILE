import { Logger } from '@nestjs/common';
import { formatAddress } from '../../../common/utils/address.util';
import { haversineKm } from '../../../common/utils/geo.util';
import {
  DistanceMatrixResult,
  GeocodeResult,
  IMapProvider,
  PlaceAutocompleteItem,
} from '../interfaces/map-provider.interface';
import { RateLimiter, SimpleCache } from '../utils/rate-limiter.util';

export class NominatimMapProvider implements IMapProvider {
  readonly name = 'OpenStreetMap Nominatim (Development)';
  private readonly logger = new Logger(NominatimMapProvider.name);

  // Tuân thủ nghiêm ngặt chính sách OSM: tối đa 1 req/giây -> Đặt 1.100ms
  private readonly limiter = new RateLimiter(1100);

  // Cache kết quả để tránh gọi lại nhiều lần các điểm quen thuộc
  private readonly geocodeCache = new SimpleCache<GeocodeResult>(24 * 60 * 60 * 1000);
  private readonly searchCache = new SimpleCache<PlaceAutocompleteItem[]>(12 * 60 * 60 * 1000);

  // User-Agent định danh theo đúng yêu cầu chính sách OSMF
  private readonly userAgent = 'FoodDeliveryApp-Dev/1.0 (contact: admin@fooddelivery.local)';

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    const cacheKey = `rev_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) return cached;

    await this.limiter.throttle();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Nominatim phản hồi mã HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.display_name) {
        const cleanAddress = formatAddress(data.display_name);
        const result: GeocodeResult = {
          addressLine: cleanAddress,
          latitude: lat,
          longitude: lng,
        };
        this.geocodeCache.set(cacheKey, result);
        return result;
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi Nominatim reverseGeocode: ${err.message}`);
      throw new Error(`Không thể kết nối dịch vụ bản đồ Nominatim: ${err.message}. Bạn có thể tự gõ địa chỉ chữ.`);
    }

    throw new Error('Nominatim không tìm thấy tên đường tại toạ độ này. Vui lòng tự nhập địa chỉ.');
  }

  async searchPlaces(query: string, lat?: number, lng?: number): Promise<PlaceAutocompleteItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `search_${trimmed.toLowerCase()}_${lat?.toFixed(2)}_${lng?.toFixed(2)}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    await this.limiter.throttle();

    try {
      const encoded = encodeURIComponent(trimmed);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=vn&limit=8&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Nominatim Search phản hồi mã HTTP ${res.status}`);
      }

      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const results = list.map((item: any) => ({
          placeId: String(item.place_id),
          description: formatAddress(item.display_name),
          mainText: item.address?.road || item.address?.suburb || item.display_name.split(',')[0],
          secondaryText: formatAddress(item.display_name),
        }));
        this.searchCache.set(cacheKey, results);
        return results;
      }
      return [];
    } catch (err: any) {
      this.logger.warn(`Lỗi Nominatim searchPlaces: ${err.message}`);
      throw new Error(`Không thể tìm kiếm qua Nominatim: ${err.message}`);
    }
  }

  async getPlaceDetail(placeId: string): Promise<GeocodeResult | null> {
    await this.limiter.throttle();

    try {
      const url = `https://nominatim.openstreetmap.org/details?format=json&place_id=${placeId}&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      });

      if (!res.ok) return null;
      const data = await res.json();
      const lat = parseFloat(data.lat || data.centroid?.coordinates?.[1]);
      const lng = parseFloat(data.lon || data.centroid?.coordinates?.[0]);
      const display = data.localname || data.extratags?.name || 'Vị trí đã chọn';

      return {
        addressLine: formatAddress(display),
        latitude: lat,
        longitude: lng,
      };
    } catch (err: any) {
      this.logger.warn(`Lỗi Nominatim getPlaceDetail: ${err.message}`);
      return null;
    }
  }

  async getDistanceMatrix(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<DistanceMatrixResult> {
    // Tính khoảng cách đường bộ bằng Haversine x hệ số uốn lượn đường phố nội đô (1.35)
    const directKm = haversineKm(origin, destination);
    const distanceKm = Math.max(0.5, Math.round(directKm * 1.35 * 10) / 10);
    // Vận tốc xe máy trung bình 24 km/h + 8 phút đèn đỏ & giao lộ
    const durationMinutes = Math.max(5, Math.round(distanceKm * 2.5 + 8));

    return { distanceKm, durationMinutes };
  }
}

