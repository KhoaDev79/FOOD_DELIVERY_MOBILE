import {
  isValidVietnameseLicensePlate,
  maskBankAccountNumber,
  normalizeLicensePlate,
} from './vietnamese-plate.util';

describe('vietnamese-plate.util', () => {
  describe('normalizeLicensePlate', () => {
    it('chuyển thành chữ hoa và xoá khoảng trắng thừa', () => {
      expect(normalizeLicensePlate('  59-x1 123.45  ')).toBe('59-X1 123.45');
      expect(normalizeLicensePlate('')).toBeNull();
      expect(normalizeLicensePlate(null)).toBeNull();
    });
  });

  describe('isValidVietnameseLicensePlate', () => {
    it('chấp nhận biển số xe máy 5 số hợp lệ', () => {
      expect(isValidVietnameseLicensePlate('59-X1 123.45')).toBe(true);
      expect(isValidVietnameseLicensePlate('29-H1 888.88')).toBe(true);
      expect(isValidVietnameseLicensePlate('43-B1 999.99')).toBe(true);
      expect(isValidVietnameseLicensePlate('59X1-123.45')).toBe(true);
      expect(isValidVietnameseLicensePlate('59-X1 12345')).toBe(true);
    });

    it('chấp nhận biển số xe máy 4 số và xe điện hợp lệ', () => {
      expect(isValidVietnameseLicensePlate('29-H1 8888')).toBe(true);
      expect(isValidVietnameseLicensePlate('59-MĐ1 123.45')).toBe(true);
    });

    it('từ chối chuỗi không đúng định dạng', () => {
      expect(isValidVietnameseLicensePlate('')).toBe(false);
      expect(isValidVietnameseLicensePlate(null)).toBe(false);
      expect(isValidVietnameseLicensePlate('ABC-123')).toBe(false);
      expect(isValidVietnameseLicensePlate('123456789')).toBe(false);
      expect(isValidVietnameseLicensePlate('INVALID-PLATE')).toBe(false);
    });
  });

  describe('maskBankAccountNumber', () => {
    it('ẩn số tài khoản chỉ giữ 4 số cuối', () => {
      expect(maskBankAccountNumber('0123456789')).toBe('**** 6789');
      expect(maskBankAccountNumber('9988776655')).toBe('**** 6655');
      expect(maskBankAccountNumber('1234')).toBe('1234');
      expect(maskBankAccountNumber(null)).toBeNull();
    });
  });
});

