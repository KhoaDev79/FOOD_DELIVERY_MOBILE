import { estimateDeliveryWindow } from './delivery-time';

describe('estimateDeliveryWindow', () => {
  it('quãng đường càng xa thì thời gian càng dài, không bao giờ ngắn hơn', () => {
    const distances = [0.01, 1, 2.5, 5, 8, 12, 15];
    const windows = distances.map((d) => estimateDeliveryWindow({ distanceKm: d }));
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].min).toBeGreaterThanOrEqual(windows[i - 1].min);
      expect(windows[i].max).toBeGreaterThanOrEqual(windows[i - 1].max);
    }
  });

  it('cho các mốc thực tế (không cao điểm)', () => {
    expect(estimateDeliveryWindow({ distanceKm: 0.01 })).toEqual({ min: 20, max: 25 }); // gần như cạnh quán
    expect(estimateDeliveryWindow({ distanceKm: 2.5 })).toEqual({ min: 25, max: 30 });
    expect(estimateDeliveryWindow({ distanceKm: 5 })).toEqual({ min: 30, max: 40 });
    expect(estimateDeliveryWindow({ distanceKm: 12 })).toEqual({ min: 55, max: 70 });
  });

  it('ưu tiên thời gian chạy xe thật của tuyến đường', () => {
    // 5 km nhưng đường thông thoáng chỉ 10 phút chạy xe
    expect(estimateDeliveryWindow({ distanceKm: 5, roadMinutes: 10 })).toEqual({ min: 25, max: 30 });
  });

  it('giờ cao điểm lâu hơn giờ thường', () => {
    const normal = estimateDeliveryWindow({ distanceKm: 5 });
    const peak = estimateDeliveryWindow({ distanceKm: 5, isPeak: true });
    expect(peak.min).toBeGreaterThan(normal.min);
    expect(peak.max).toBeGreaterThan(normal.max);
  });

  it('khoảng luôn hợp lệ: tối thiểu 15 phút và max > min', () => {
    for (const d of [0, 0.5, 3, 20, 40]) {
      const w = estimateDeliveryWindow({ distanceKm: d });
      expect(w.min).toBeGreaterThanOrEqual(15);
      expect(w.max).toBeGreaterThan(w.min);
    }
  });
});
