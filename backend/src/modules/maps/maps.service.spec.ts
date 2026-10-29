import { ConfigService } from '@nestjs/config';
import { MapsService } from './maps.service';

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

  it('tính toán khoảng cách đường bộ dự kiến', async () => {
    const config = {
      get: jest.fn((key: string) => (key === 'MAP_PROVIDER' ? 'fallback' : undefined)),
    } as unknown as ConfigService;
    const service = new MapsService(config);

    const result = await service.getDistance(
      { lat: 10.7782, lng: 106.7011 },
      { lat: 10.8365, lng: 106.685 },
    );
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.distanceKm).toBeLessThan(15);
    expect(result.durationMinutes).toBeGreaterThan(10);
  });
});
