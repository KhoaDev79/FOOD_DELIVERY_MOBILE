import { CSV_BOM, csvCell, csvFileName, toCsv, vnDateRange, vnDateTime } from './csv.util';

describe('csvCell', () => {
  it('bọc ngoặc kép khi có dấu phẩy, ngoặc kép, xuống dòng', () => {
    expect(csvCell('Phở, Bún')).toBe('"Phở, Bún"');
    expect(csvCell('Quán "Ngon"')).toBe('"Quán ""Ngon"""');
    expect(csvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
    expect(csvCell('Bình thường')).toBe('Bình thường');
  });

  it('chặn ô bị Excel hiểu là công thức', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+84912')).toBe("'+84912");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('số để nguyên, rỗng thành ô trống', () => {
    expect(csvCell(125000)).toBe('125000');
    expect(csvCell(-5000)).toBe('-5000');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });
});

describe('toCsv', () => {
  it('có BOM, xuống dòng CRLF', () => {
    const csv = toCsv(['Mã', 'Tổng'], [['A1', 1000], ['B2', null]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Mã,Tổng\r\nA1,1000\r\nB2,\r\n`);
  });
});

describe('vnDateRange', () => {
  const now = new Date('2026-11-03T02:00:00Z'); // 09:00 ngày 03/11 giờ VN

  it('khoảng ngày VN gồm cả 2 đầu → mốc UTC', () => {
    const r = vnDateRange('2026-11-01', '2026-11-03', now);
    expect(r.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });

  it('mặc định 30 ngày đến hôm nay', () => {
    const r = vnDateRange(undefined, undefined, now);
    expect(r.to).toBe('2026-11-03');
    expect(r.from).toBe('2026-10-05');
  });

  it('báo lỗi ngày sai, đảo ngược, quá dài', () => {
    expect(() => vnDateRange('2026-13-40', '2026-11-03', now)).toThrow(RangeError);
    expect(() => vnDateRange('01/11/2026', undefined, now)).toThrow('YYYY-MM-DD');
    expect(() => vnDateRange('2026-11-05', '2026-11-01', now)).toThrow('trước');
    expect(() => vnDateRange('2024-01-01', '2026-11-01', now)).toThrow('tối đa');
  });
});

describe('vnDateTime / csvFileName', () => {
  it('giờ VN dd/mm/yyyy HH:mm', () => {
    expect(vnDateTime(new Date('2026-11-02T07:05:00Z'))).toBe('02/11/2026 14:05');
    expect(csvFileName('zomzom-don-hang', '2026-10-01', '2026-10-31')).toBe('zomzom-don-hang_2026-10-01_2026-10-31.csv');
  });
});
