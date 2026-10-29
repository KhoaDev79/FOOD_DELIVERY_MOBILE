import { Logger } from '@nestjs/common';
import { formatAddress } from '../../../common/utils/address.util';
import { haversineKm } from '../../../common/utils/geo.util';
import {
  DistanceMatrixResult,
  GeocodeResult,
  IMapProvider,
  PlaceAutocompleteItem,
} from '../interfaces/map-provider.interface';

export class FallbackMapProvider implements IMapProvider {
  readonly name = 'OpenStreetMap & Local Fallback';
  private readonly logger = new Logger(FallbackMapProvider.name);

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FoodDeliveryBackend/1.0 (contact: admin@fooddelivery.com)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          return {
            addressLine: formatAddress(data.display_name),
            latitude: lat,
            longitude: lng,
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(`Nominatim reverseGeocode fallback error: ${err.message}`);
    }

    // Dự phòng offline không bao giờ trả toạ độ thô
    return {
      addressLine: `Khu vực toạ độ (${lat.toFixed(4)}, ${lng.toFixed(4)}), TP. Hồ Chí Minh`,
      latitude: lat,
      longitude: lng,
    };
  }

  async searchPlaces(query: string, lat?: number, lng?: number): Promise<PlaceAutocompleteItem[]> {
    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=vn&limit=8&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FoodDeliveryBackend/1.0 (contact: admin@fooddelivery.com)' },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any) => ({
            placeId: String(item.place_id),
            description: formatAddress(item.display_name),
            mainText: item.address?.road || item.address?.suburb || item.display_name.split(',')[0],
            secondaryText: formatAddress(item.display_name),
          }));
        }
      }
    } catch (err: any) {
      this.logger.warn(`Nominatim searchPlaces fallback error: ${err.message}`);
    }
    return [];
  }

  async getPlaceDetail(placeId: string): Promise<GeocodeResult | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/details?format=json&place_id=${placeId}&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FoodDeliveryBackend/1.0 (contact: admin@fooddelivery.com)' },
      });
      if (res.ok) {
        const data = await res.json();
        const lat = parseFloat(data.lat || data.centroid?.coordinates?.[1]);
        const lng = parseFloat(data.lon || data.centroid?.coordinates?.[0]);
        const display = data.localname || data.extratags?.name || 'Vị trí đã chọn';
        return {
          addressLine: formatAddress(display),
          latitude: lat,
          longitude: lng,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Nominatim getPlaceDetail fallback error: ${err.message}`);
    }
    return null;
  }

  async getDistanceMatrix(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<DistanceMatrixResult> {
    // Tính khoảng cách đường bộ bằng Haversine x hệ số uốn lượn đường phố nội đô (1.35)
    const directKm = haversineKm(origin, destination);
    const distanceKm = Math.max(0.5, Math.round(directKm * 1.35 * 10) / 10);

    // Thời gian xe máy tại nội đô: ~22-25 km/h + 8 phút đèn đỏ/chờ
    const durationMinutes = Math.max(5, Math.round(distanceKm * 2.8 + 8));

    return { distanceKm, durationMinutes };
  }
}

