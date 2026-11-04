import { dmy, exportFileName, presetRange } from './exportRange';

describe('presetRange', () => {
  const now = new Date(2026, 10, 3, 9, 0); // 03/11/2026 09:00 giờ máy

  it('7 và 30 ngày tính cả hôm nay', () => {
    expect(presetRange('7d', now)).toEqual({ from: '2026-10-28', to: '2026-11-03' });
    expect(presetRange('30d', now)).toEqual({ from: '2026-10-05', to: '2026-11-03' });
  });

  it('tháng này / tháng trước (kể cả qua năm)', () => {
    expect(presetRange('thisMonth', now)).toEqual({ from: '2026-11-01', to: '2026-11-03' });
    expect(presetRange('lastMonth', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('lastMonth', new Date(2027, 0, 15))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(presetRange('lastMonth', new Date(2026, 2, 10))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('định dạng hiển thị và tên file', () => {
    expect(dmy('2026-10-01')).toBe('01/10/2026');
    expect(exportFileName('zomzom-doanh-thu', '2026-10-01', '2026-10-31')).toBe('zomzom-doanh-thu_2026-10-01_2026-10-31.csv');
  });
});
