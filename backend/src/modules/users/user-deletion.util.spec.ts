import { Role } from '@prisma/client';
import { canDeleteUserAccount, generateAnonymizedEmail } from './user-deletion.util';

describe('user-deletion.util', () => {
  describe('canDeleteUserAccount', () => {
    it('cho phép khách hàng xoá tài khoản khi không có đơn hàng đang chạy', () => {
      const res = canDeleteUserAccount({
        role: Role.CUSTOMER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 0,
      });
      expect(res.allowed).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    it('chặn khách hàng xoá tài khoản khi có đơn hàng chưa hoàn tất', () => {
      const res = canDeleteUserAccount({
        role: Role.CUSTOMER,
        activeCustomerOrdersCount: 1,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 0,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('đơn hàng chưa hoàn tất');
    });

    it('chặn tài xế xoá tài khoản khi đang nhận đơn giao', () => {
      const res = canDeleteUserAccount({
        role: Role.DRIVER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 2,
        activeRestaurantOrdersCount: 0,
        driverCodBalance: 0,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Tài xế đang có đơn hàng nhận giao');
    });

    it('chặn tài xế xoá tài khoản khi còn nợ COD', () => {
      const res = canDeleteUserAccount({
        role: Role.DRIVER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 0,
        driverCodBalance: 500000,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('công nợ COD');
    });

    it('cho phép tài xế xoá tài khoản khi không có đơn và nợ COD = 0', () => {
      const res = canDeleteUserAccount({
        role: Role.DRIVER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 0,
        driverCodBalance: 0,
      });
      expect(res.allowed).toBe(true);
    });

    it('chặn chủ quán xoá tài khoản khi quán đang có đơn xử lý', () => {
      const res = canDeleteUserAccount({
        role: Role.RESTAURANT_OWNER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 3,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Quán ăn của bạn đang có đơn hàng đang xử lý');
    });

    it('cho phép chủ quán xoá tài khoản khi quán không có đơn đang chạy', () => {
      const res = canDeleteUserAccount({
        role: Role.RESTAURANT_OWNER,
        activeCustomerOrdersCount: 0,
        activeDriverOrdersCount: 0,
        activeRestaurantOrdersCount: 0,
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe('generateAnonymizedEmail', () => {
    it('tạo email ẩn danh đúng định dạng duy nhất', () => {
      const email = generateAnonymizedEmail('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1700000000000);
      expect(email).toBe('deleted_1700000000000_a1b2c3d4@deleted.zomzom.local');
    });
  });
});

