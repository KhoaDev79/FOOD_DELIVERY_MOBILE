import { cleanAndValidateAddress, formatAddress, isCoordinateAddress } from './address.util';

describe('AddressUtil', () => {
  describe('isCoordinateAddress', () => {
    it('nhận diện đúng các chuỗi toạ độ thô cần chặn', () => {
      expect(isCoordinateAddress('Tọa độ: 10.83653, 106.68504')).toBe(true);
      expect(isCoordinateAddress('Toạ độ: 10.777, 106.701')).toBe(true);
      expect(isCoordinateAddress('10.83653, 106.68504')).toBe(true);
      expect(isCoordinateAddress('Vị trí hiện tại (10.777, 106.701)')).toBe(true);
      expect(isCoordinateAddress('[Tầng 3] Tọa độ: 10.83653, 106.68504')).toBe(true);
      expect(isCoordinateAddress('   10.77820, 106.70110   ')).toBe(true);
      expect(isCoordinateAddress('')).toBe(true);
      expect(isCoordinateAddress('12345')).toBe(true);
    });

    it('cho phép các địa chỉ hợp lệ bằng chữ', () => {
      expect(isCoordinateAddress('45 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh')).toBe(false);
      expect(isCoordinateAddress('496/32/15 Dương Quảng Hàm, Phường An Nhơn, TP.HCM')).toBe(false);
      expect(isCoordinateAddress('[Tầng 4] 123 Nguyễn Huệ, Phường Bến Nghé, TP.HCM')).toBe(false);
      expect(isCoordinateAddress('Xã Phú Xuân, Tỉnh Đồng Nai')).toBe(false);
    });
  });

  describe('formatAddress', () => {
    it('loại bỏ phần lặp phường, xã liền kề hoặc trùng lặp', () => {
      const input = '6, Hẻm 496/32 Dương Quảng Hàm, P. An Nhơn, P. An Nhơn';
      expect(formatAddress(input)).toBe('6, Hẻm 496/32 Dương Quảng Hàm, P. An Nhơn');
    });

    it('loại bỏ các cấp hành chính lặp lại liên tiếp', () => {
      const input =
        'Phường 5, Phường 5, Quận Gò Vấp, Quận Gò Vấp, Thành phố Hồ Chí Minh, Thành phố Hồ Chí Minh';
      expect(formatAddress(input)).toBe('Phường 5, Quận Gò Vấp, Thành phố Hồ Chí Minh');
    });

    it('giữ nguyên chuỗi địa chỉ bình thường không bị lặp', () => {
      const input = '45 Lê Thánh Tôn, Phường Bến Nghé, TP. Hồ Chí Minh';
      expect(formatAddress(input)).toBe('45 Lê Thánh Tôn, Phường Bến Nghé, TP. Hồ Chí Minh');
    });

    it('hỗ trợ cấu trúc địa giới mới 2 cấp (xã/phường và tỉnh/thành phố)', () => {
      const input = 'Số 10 Nguyễn Trãi, Phường Bến Thành, Thành phố Hồ Chí Minh';
      expect(formatAddress(input)).toBe('Số 10 Nguyễn Trãi, Phường Bến Thành, Thành phố Hồ Chí Minh');
    });
  });

  describe('cleanAndValidateAddress (Xử lý dữ liệu xấu cố ý & Idempotency)', () => {
    it('xử lý chuỗi toạ độ thô cố ý: đánh dấu [Cần xác nhận] và bật needsConfirmation', () => {
      const result = cleanAndValidateAddress('10.83653, 106.68504', 10.83653, 106.68504, false);
      expect(result.isModified).toBe(true);
      expect(result.needsConfirmation).toBe(true);
      expect(result.cleanedAddress).toBe('[Cần xác nhận] Vị trí toạ độ (10.83653, 106.68504)');
      expect(result.reason).toContain('Toạ độ thô');
    });

    it('xử lý chuỗi có tiền tố Toạ độ: ...', () => {
      const result = cleanAndValidateAddress('Tọa độ: 10.83653, 106.68504', 10.83653, 106.68504, false);
      expect(result.isModified).toBe(true);
      expect(result.needsConfirmation).toBe(true);
      expect(result.cleanedAddress).toBe('[Cần xác nhận] Vị trí toạ độ (10.83653, 106.68504)');
    });

    it('xử lý địa chỉ bị lặp phường cố ý: khử lặp chính xác', () => {
      const result = cleanAndValidateAddress(
        '123 Lê Lợi, Phường Bến Nghé, Phường Bến Nghé, TP. Hồ Chí Minh',
        10.778,
        106.702,
        false,
      );
      expect(result.isModified).toBe(true);
      expect(result.cleanedAddress).toBe('123 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh');
      expect(result.reason).toContain('Khử lặp cấp hành chính');
    });

    it('tính Idempotent: chạy lại trên địa chỉ đã có tiền tố [Cần xác nhận] thì KHÔNG bị đổi', () => {
      const firstRun = cleanAndValidateAddress('10.83653, 106.68504', 10.83653, 106.68504, false);
      expect(firstRun.cleanedAddress).toBe('[Cần xác nhận] Vị trí toạ độ (10.83653, 106.68504)');

      // Chạy lại lần 2 với kết quả của lần 1
      const secondRun = cleanAndValidateAddress(
        firstRun.cleanedAddress,
        10.83653,
        106.68504,
        firstRun.needsConfirmation,
      );
      expect(secondRun.isModified).toBe(false);
      expect(secondRun.cleanedAddress).toBe(firstRun.cleanedAddress);
      expect(secondRun.needsConfirmation).toBe(true);
    });

    it('nhận diện địa chỉ suy đoán cũ (496 Dương Quảng Hàm) và đánh dấu cần xác nhận', () => {
      const result = cleanAndValidateAddress(
        'Hẻm 496 Dương Quảng Hàm, Phường An Nhơn, TP. Hồ Chí Minh',
        10.83653,
        106.68504,
        false,
      );
      expect(result.isModified).toBe(true);
      expect(result.needsConfirmation).toBe(true);
      expect(result.reason).toContain('Địa chỉ mẫu suy đoán cũ');
    });

    it('đối với địa chỉ chuẩn không lỗi: giữ nguyên và không đánh dấu sửa', () => {
      const result = cleanAndValidateAddress(
        '45 Lê Duẩn, Phường Bến Nghé, TP. Hồ Chí Minh',
        10.778,
        106.702,
        false,
      );
      expect(result.isModified).toBe(false);
      expect(result.needsConfirmation).toBe(false);
      expect(result.cleanedAddress).toBe('45 Lê Duẩn, Phường Bến Nghé, TP. Hồ Chí Minh');
    });
  });
});

