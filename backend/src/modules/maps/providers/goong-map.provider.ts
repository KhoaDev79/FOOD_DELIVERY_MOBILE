import { Logger } from '@nestjs/common';
import { formatAddress } from '../../../common/utils/address.util';
import {
  DistanceMatrixResult,
  GeocodeResult,
  IMapProvider,
  PlaceAutocompleteItem,
} from '../interfaces/map-provider.interface';
import { RateLimiter, SimpleCache } from '../utils/rate-limiter.util';

export class GoongMapProvider implements IMapProvider {
  readonly name = 'Goong Map';
  private readonly logger = new Logger(GoongMapProvider.name);

  // Giới hạn tốc độ phía Backend: 600ms/req (~100 req/phút), thấp hơn nhiều so với hạn mức Goong Free 180 req/phút
  private readonly limiter = new RateLimiter(600);

  // Cache kết quả tránh lãng phí hạn mức 30.000 req/tháng
  private readonly geocodeCache = new SimpleCache<GeocodeResult>(24 * 60 * 60 * 1000);
  private readonly searchCache = new SimpleCache<PlaceAutocompleteItem[]>(12 * 60 * 60 * 1000);

  constructor(private readonly apiKey: string) {}

  private checkKey() {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error(
        'Chưa cấu hình GOONG_API_KEY. Vui lòng cung cấp khoá trong file .env hoặc chọn MAP_PROVIDER=nominatim.',
      );
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    this.checkKey();
    const cacheKey = `goong_rev_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) return cached;

    await this.limiter.throttle();

    const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${this.apiKey}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Khoá Goong API Key không hợp lệ hoặc tài khoản chưa kích hoạt. Vui lòng kiểm tra lại.');
    }
    if (!res.ok) {
      throw new Error(`Dịch vụ Goong Geocode báo lỗi HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      throw new Error('Goong không tìm thấy địa chỉ tại toạ độ này.');
    }

    const first = data.results[0];
    const rawFormatted = first.formatted_address || '';
    const cleanAddress = formatAddress(rawFormatted);

    const result: GeocodeResult = {
      addressLine: cleanAddress,
      latitude: first.geometry?.location?.lat ?? lat,
      longitude: first.geometry?.location?.lng ?? lng,
    };
    this.geocodeCache.set(cacheKey, result);
    return result;
  }

  async searchPlaces(query: string, lat?: number, lng?: number): Promise<PlaceAutocompleteItem[]> {
    this.checkKey();
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `goong_search_${trimmed.toLowerCase()}_${lat?.toFixed(2)}_${lng?.toFixed(2)}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    await this.limiter.throttle();

    let url = `https://rsapi.goong.io/Place/AutoComplete?api_key=${this.apiKey}&input=${encodeURIComponent(trimmed)}&limit=10`;
    if (lat !== undefined && lng !== undefined) {
      url += `&location=${lat},${lng}`;
    }

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Khoá Goong API Key không hợp lệ hoặc tài khoản chưa kích hoạt.');
    }
    if (!res.ok) {
      throw new Error(`Dịch vụ Goong AutoComplete báo lỗi HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.predictions) return [];

    const results = data.predictions.map((p: any) => ({
      placeId: p.place_id,
      description: formatAddress(p.description),
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: formatAddress(p.structured_formatting?.secondary_text || ''),
    }));
    this.searchCache.set(cacheKey, results);
    return results;
  }

  async getPlaceDetail(placeId: string): Promise<GeocodeResult | null> {
    this.checkKey();
    await this.limiter.throttle();

    const url = `https://rsapi.goong.io/Place/Detail?place_id=${placeId}&api_key=${this.apiKey}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data.result;
    if (!result) return null;

    return {
      addressLine: formatAddress(result.formatted_address),
      latitude: result.geometry?.location?.lat,
      longitude: result.geometry?.location?.lng,
    };
  }

  async getDistanceMatrix(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<DistanceMatrixResult> {
    this.checkKey();
    await this.limiter.throttle();

    const url = `https://rsapi.goong.io/DistanceMatrix?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&vehicle=bike&api_key=${this.apiKey}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Goong DistanceMatrix báo lỗi HTTP ${res.status}`);
    }

    const data = await res.json();
    const element = data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
      throw new Error('Goong DistanceMatrix không tìm thấy tuyến đường phù hợp.');
    }

    const distanceKm = Math.round((element.distance.value / 1000) * 10) / 10;
    const durationMinutes = Math.max(1, Math.round(element.duration.value / 60));

    return { distanceKm, durationMinutes };
  }
}
