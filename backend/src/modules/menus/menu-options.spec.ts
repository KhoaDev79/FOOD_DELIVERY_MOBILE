import { BadRequestException } from '@nestjs/common';
import { priceOrderLine } from '../orders/order-pricing';
import { normalizeMenuOptions } from './menu-options';

describe('normalizeMenuOptions', () => {
  it('cấp id mới, bỏ dòng trống, gộp khoảng trắng', () => {
    const res = normalizeMenuOptions({
      sizes: [
        { name: '  Tô   thường ', price: 0 },
        { name: '', price: 5000 },
        { name: 'Tô đặc biệt', price: 15000 },
      ],
    });
    expect(res?.sizes).toHaveLength(2);
    expect(res?.sizes?.[0].name).toBe('Tô thường');
    expect(res?.sizes?.[0].id).toMatch(/^size_/);
    expect(res?.sizes?.[1].price).toBe(15000);
  });

  it('giữ nguyên id cũ khi sửa giá/tên, để món trong giỏ khách vẫn đặt được', () => {
    const previous = {
      sizes: [{ id: 'to_thuong', name: 'Tô Thường', price: 0 }],
      toppings: [{ id: 'quay', name: 'Quẩy giòn', price: 8000 }],
    };
    const res = normalizeMenuOptions(
      {
        // id gửi lại -> giữ; tên trùng (khác hoa thường) -> giữ id cũ
        sizes: [{ id: 'to_thuong', name: 'Tô thường (mới)', price: 2000 }],
        toppings: [{ name: 'quẩy giòn', price: 9000 }],
      },
      previous,
    );
    expect(res?.sizes?.[0]).toEqual({ id: 'to_thuong', name: 'Tô thường (mới)', price: 2000 });
    expect(res?.toppings?.[0].id).toBe('quay');
    expect(res?.toppings?.[0].price).toBe(9000);
  });

  it('báo lỗi khi trùng tên trong cùng danh sách', () => {
    expect(() =>
      normalizeMenuOptions({
        toppings: [
          { name: 'Trứng', price: 5000 },
          { name: 'trứng', price: 6000 },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('không cho dùng cả mức cay lẫn mức đường', () => {
    expect(() => normalizeMenuOptions({ spiceLevels: ['Không cay'], sugarLevels: ['Ít đường'] })).toThrow(
      BadRequestException,
    );
  });

  it('trả null khi không còn tuỳ chọn nào (xoá tuỳ chọn của món)', () => {
    expect(normalizeMenuOptions({ sizes: [], toppings: [{ name: '  ', price: 0 }] })).toBeNull();
    expect(normalizeMenuOptions(null)).toBeNull();
  });

  it('kết quả dùng được ngay cho tính giá đơn hàng', () => {
    const options = normalizeMenuOptions({
      sizes: [
        { name: 'M', price: 0 },
        { name: 'L', price: 10000 },
      ],
      toppings: [{ name: 'Trân châu', price: 5000 }],
      sugarLevels: ['100%', '50%'],
    });
    const { unitPrice } = priceOrderLine(
      { name: 'Trà sữa', price: 30000, options },
      { sizeId: options!.sizes![1].id, toppingIds: [options!.toppings![0].id], level: '50%' },
    );
    expect(unitPrice).toBe(45000);
  });
});
