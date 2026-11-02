import { normalizeVnPhone, transformOptionalPhone, VN_MOBILE_REGEX } from './phone.util';

describe('phone.util', () => {
  it('các cách viết khác nhau của cùng một số về một dạng', () => {
    for (const raw of ['0912345678', '0912 345 678', '0912.345.678', '+84912345678', '84912345678', ' +84 912-345-678 ']) {
      expect(normalizeVnPhone(raw)).toBe('0912345678');
    }
  });

  it('chỉ nhận số di động VN 10 chữ số với đầu số hợp lệ', () => {
    expect(VN_MOBILE_REGEX.test('0912345678')).toBe(true);
    expect(VN_MOBILE_REGEX.test('0387654321')).toBe(true);
    expect(VN_MOBILE_REGEX.test('09123456789')).toBe(false); // 11 số
    expect(VN_MOBILE_REGEX.test('091234567')).toBe(false); // 9 số
    expect(VN_MOBILE_REGEX.test('0112345678')).toBe(false); // đầu số không tồn tại
  });

  it('chuỗi rỗng coi như không nhập', () => {
    expect(transformOptionalPhone('')).toBeUndefined();
    expect(transformOptionalPhone('   ')).toBeUndefined();
    expect(transformOptionalPhone(undefined)).toBeUndefined();
  });
});
