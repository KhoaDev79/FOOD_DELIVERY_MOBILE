import { ConfigService } from '@nestjs/config';
import { MapsService } from './maps.service';
import { decodePolyline } from './utils/polyline.util';

describe('MapsService', () => {
  it('khởi tạo đúng provider theo biến MAP_PROVIDER = nominatim', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'nominatim';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);
    expect(service.getProviderName()).toContain('Nominatim');
  });

  it('khởi tạo đúng provider theo biến MAP_PROVIDER = fallback', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'fallback';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);
    expect(service.getProviderName()).toContain('Fallback');
  });

  it('báo lỗi tiếng Việt rõ ràng khi chọn goong nhưng chưa có key', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'goong';
        if (key === 'GOONG_API_KEY') return '';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);
    expect(service.getProviderName()).toContain('Goong');

    // Gọi reverse geocode không có key -> ném lỗi tiếng Việt rõ ràng, KHÔNG tự ý chuyển ngầm
    await expect(service.reverseGeocode(10.8365, 106.685)).rejects.toThrow(
      /Chưa cấu hình GOONG_API_KEY/i,
    );
  });

  it('tính toán khoảng cách đường bộ dự kiến (ESTIMATED khi không có GOONG_API_KEY) và lưu cache', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'fallback';
        if (key === 'business.roadDistanceFallbackFactor') return 1.3;
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);

    const result = await service.getRoadDistance(
      { lat: 10.7782, lng: 106.7011 },
      { lat: 10.8365, lng: 106.685 },
    );
    expect(result.source).toBe('ESTIMATED');
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.distanceKm).toBeLessThan(15);
    expect(result.durationMinutes).toBeGreaterThan(10);

    // Gọi lại với toạ độ lệch rất nhỏ (cùng 3 chữ số thập phân) phải trúng cache
    const cached = await service.getRoadDistance(
      { lat: 10.77824, lng: 106.70112 },
      { lat: 10.83651, lng: 106.68504 },
    );
    expect(cached).toEqual(result);
  });

  it('trả đoạn thẳng ESTIMATED để vẽ đường khi không có GOONG_API_KEY', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'fallback';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);

    const route = await service.getRoute({ lat: 10.7782, lng: 106.7011 }, { lat: 10.8365, lng: 106.685 });
    expect(route.source).toBe('ESTIMATED');
    expect(route.coordinates).toEqual([
      { latitude: 10.7782, longitude: 106.7011 },
      { latitude: 10.8365, longitude: 106.685 },
    ]);
    expect(route.distanceKm).toBeGreaterThan(5);
  });

  it('dùng tuyến Goong Direction (ROAD) khi gọi thành công', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MAP_PROVIDER') return 'goong';
        if (key === 'GOONG_API_KEY') return 'test-key';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new MapsService(config);
    const goong = (service as any).goongProvider;
    jest.spyOn(goong, 'getDirection').mockResolvedValue({
      distanceKm: 3.2,
      durationMinutes: 11,
      coordinates: [
        { latitude: 10.1, longitude: 106.1 },
        { latitude: 10.2, longitude: 106.15 },
        { latitude: 10.3, longitude: 106.2 },
      ],
    });

    const route = await service.getRoute({ lat: 10.1, lng: 106.1 }, { lat: 10.3, lng: 106.2 });
    expect(route.source).toBe('ROAD');
    expect(route.coordinates).toHaveLength(3);
    expect(route.distanceKm).toBe(3.2);
  });
});

describe('decodePolyline', () => {
  it('giải mã đúng chuỗi mẫu chuẩn của Google', () => {
    // Ví dụ trong tài liệu "Encoded Polyline Algorithm Format"
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });
});
