import { passwordStrength } from './password';
import { formatVnPhoneInput, normalizeVnPhone, VN_MOBILE_REGEX } from './phone';

describe('normalizeVnPhone', () => {
  it('đưa mọi cách gõ về dạng 0xxxxxxxxx', () => {
    expect(normalizeVnPhone('0912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
    // Ô có sẵn +84: gõ thiếu số 0 vẫn hợp lệ
    expect(normalizeVnPhone('912 345 678')).toBe('0912345678');
    expect(VN_MOBILE_REGEX.test(normalizeVnPhone('912 345 678'))).toBe(true);
  });

  it('không tự sửa số sai đầu số', () => {
    expect(VN_MOBILE_REGEX.test(normalizeVnPhone('0112 345 678'))).toBe(false);
    expect(normalizeVnPhone('')).toBe('');
  });
});

describe('formatVnPhoneInput', () => {
  it('nhóm 4-3-3 khi có số 0, 3-3-3 khi không', () => {
    expect(formatVnPhoneInput('0912345678')).toBe('0912 345 678');
    expect(formatVnPhoneInput('091234')).toBe('0912 34');
    expect(formatVnPhoneInput('912345678')).toBe('912 345 678');
  });

  it('bỏ ký tự lạ, +84 và phần thừa', () => {
    expect(formatVnPhoneInput('09.12-345 678999')).toBe('0912 345 678');
    expect(formatVnPhoneInput('+84912345678')).toBe('912 345 678');
    expect(formatVnPhoneInput('')).toBe('');
  });
});

describe('passwordStrength', () => {
  it('phân mức yếu / trung bình / mạnh', () => {
    expect(passwordStrength('').level).toBe(0);
    expect(passwordStrength('abc').level).toBe(1);
    expect(passwordStrength('abcdefgh').level).toBe(1);
    expect(passwordStrength('abcdefg1').level).toBe(2);
    expect(passwordStrength('Abcdefg1!').level).toBe(3);
    expect(passwordStrength('Password123!').label).toBe('Mạnh');
  });
});
