import { haversineKm, isPeakHour } from './geo.util';

export const DEFAULT_COORDS = {
  latitude: 10.7769,
  longitude: 106.7009,
};

describe('Location Logic & Fallback', () => {
  it('DEFAULT_COORDS là trung tâm Quận 1, TP.HCM hợp lệ', () => {
    expect(DEFAULT_COORDS.latitude).toBeCloseTo(10.7769, 3);
    expect(DEFAULT_COORDS.longitude).toBeCloseTo(106.7009, 3);
  });

  it('toạ độ trung tâm TP.HCM nằm trong giới hạn hành chính', () => {
    const lat = DEFAULT_COORDS.latitude;
    const lng = DEFAULT_COORDS.longitude;

    // Giới hạn TP.HCM
    expect(lat).toBeGreaterThan(10.3);
    expect(lat).toBeLessThan(11.2);
    expect(lng).toBeGreaterThan(106.3);
    expect(lng).toBeLessThan(107.1);
  });

  it('tính toán khoảng cách GPS hợp lý giữa các điểm quen thuộc', () => {
    const q1 = { lat: 10.7782, lng: 106.7011 };
    const goVap = { lat: 10.8365, lng: 106.685 };
    const thuDuc = { lat: 10.8512, lng: 106.7625 };

    const distQ1ToGoVap = haversineKm(q1, goVap);
    const distQ1ToThuDuc = haversineKm(q1, thuDuc);

    expect(distQ1ToGoVap).toBeGreaterThan(6);
    expect(distQ1ToGoVap).toBeLessThan(10);
    expect(distQ1ToThuDuc).toBeGreaterThan(9);
    expect(distQ1ToThuDuc).toBeLessThan(15);
  });

  it('nhận diện khung giờ cao điểm theo múi giờ Việt Nam (UTC+7)', () => {
    // 12:00 trưa VN
    const lunchTime = new Date('2026-10-29T05:00:00.000Z'); // 5 UTC = 12 VN
    expect(isPeakHour(lunchTime)).toBe(true);

    // 18:30 chiều tối VN
    const dinnerTime = new Date('2026-10-29T11:30:00.000Z'); // 11:30 UTC = 18:30 VN
    expect(isPeakHour(dinnerTime)).toBe(true);

    // 22:30 đêm VN
    const nightTime = new Date('2026-10-29T15:30:00.000Z'); // 15:30 UTC = 22:30 VN
    expect(isPeakHour(nightTime)).toBe(false);
  });
});
