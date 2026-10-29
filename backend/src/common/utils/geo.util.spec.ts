import { boundingBox, calcDeliveryFee, haversineKm } from './geo.util';

describe('geo.util', () => {
  // Chợ Bến Thành -> Nhà thờ Đức Bà (~1.2 km)
  const benThanh = { lat: 10.7725, lng: 106.698 };
  const ducBa = { lat: 10.7798, lng: 106.699 };

  it('haversineKm returns 0 for same point', () => {
    expect(haversineKm(benThanh, benThanh)).toBe(0);
  });

  it('haversineKm computes a realistic short distance', () => {
    const d = haversineKm(benThanh, ducBa);
    expect(d).toBeGreaterThan(0.7);
    expect(d).toBeLessThan(1.0);
  });

  it('haversineKm Hà Nội -> TP.HCM ≈ 1,140 km', () => {
    const d = haversineKm({ lat: 21.0285, lng: 105.8542 }, { lat: 10.8231, lng: 106.6297 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1180);
  });

  it('boundingBox contains every point within radius', () => {
    const box = boundingBox(benThanh, 5);
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      // Điểm cách tâm ~4.9km theo nhiều hướng
      const p = {
        lat: benThanh.lat + (4.9 / 111.2) * Math.cos(rad),
        lng: benThanh.lng + (4.9 / (111.2 * Math.cos((benThanh.lat * Math.PI) / 180))) * Math.sin(rad),
      };
      expect(haversineKm(benThanh, p)).toBeLessThanOrEqual(5);
      expect(p.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(p.lat).toBeLessThanOrEqual(box.maxLat);
      expect(p.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(p.lng).toBeLessThanOrEqual(box.maxLng);
    }
  });

  it('calcDeliveryFee applies free km and rounds up to 1,000đ', () => {
    const opts = { baseFee: 15000, feePerKm: 5000, freeKm: 2 };
    expect(calcDeliveryFee(1.5, opts)).toBe(15000);
    expect(calcDeliveryFee(3, opts)).toBe(20000);
    expect(calcDeliveryFee(3.1, opts)).toBe(21000); // 20,500 -> 21,000
  });
});
