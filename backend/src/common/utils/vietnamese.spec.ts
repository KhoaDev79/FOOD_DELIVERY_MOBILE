import { foldVietnamese, VI_ACCENTED, VI_PLAIN } from './vietnamese';

describe('foldVietnamese', () => {
  it('bỏ dấu và viết thường', () => {
    expect(foldVietnamese('Phở Bò Gia Truyền')).toBe('pho bo gia truyen');
    expect(foldVietnamese('Đặc Biệt Cần Giờ')).toBe('dac biet can gio');
    expect(foldVietnamese('Bún bò Huế')).toBe('bun bo hue');
  });

  it('bảng ký tự hai chiều dài bằng nhau (điều kiện của translate())', () => {
    expect([...VI_ACCENTED].length).toBe([...VI_PLAIN].length);
  });
});
