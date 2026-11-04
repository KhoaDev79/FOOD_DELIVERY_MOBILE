import { adminOrderRows, ExportOrder, maskName, restaurantRevenueRows } from './order-export.util';

const order = (over: Partial<ExportOrder>): ExportOrder => ({
  id: '3bed0ba5-df40-4a3e-8b92-db86ff70adb9',
  createdAt: new Date('2026-11-02T07:05:00Z'),
  status: 'DELIVERED',
  paymentMethod: 'COD',
  paymentStatus: 'PAID',
  subtotal: 100_000,
  deliveryFee: 15_000,
  peakSurcharge: 0,
  discountAmount: 0,
  total: 115_000,
  platformCommission: 20_000,
  driverEarning: 12_000,
  distanceKm: 3.27,
  cancelReason: null,
  failedReason: null,
  cancelNote: null,
  restaurant: { name: 'Phở Ngon' },
  customer: { fullName: 'Nguyễn Văn An', phone: '0912345678' },
  driver: { fullName: 'Ryan' },
  items: [
    { name: 'Phở bò', quantity: 2 },
    { name: 'Trà đá', quantity: 1 },
  ],
  ...over,
});

describe('adminOrderRows', () => {
  it('mã 8 ký tự, giờ VN, nhãn tiếng Việt, lý do huỷ', () => {
    const [row] = adminOrderRows([
      order({ status: 'CANCELLED', cancelReason: 'RESTAURANT_TIMEOUT', paymentStatus: 'UNPAID', driver: null }),
    ]);
    expect(row.slice(0, 3)).toEqual(['3BED0BA5', '02/11/2026 14:05', 'Đã huỷ']);
    expect(row[6]).toBe('');
    expect(row[9]).toBe(3);
    expect(row[20]).toBe(3.3);
    expect(row[21]).toBe('Quán không nhận đúng hạn');
  });
});

describe('restaurantRevenueRows', () => {
  it('chỉ tính tiền đơn giao thành công, có dòng TỔNG, che tên khách', () => {
    const rows = restaurantRevenueRows([
      order({}),
      order({ id: 'aaaaaaaa-0000-0000-0000-000000000000', subtotal: 50_000 }),
      order({ id: 'bbbbbbbb-0000-0000-0000-000000000000', status: 'CANCELLED', cancelReason: 'CUSTOMER_CHANGED_MIND' }),
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0][3]).toBe('Nguyễn V. A.');
    expect(rows[0][4]).toBe('2x Phở bò; 1x Trà đá');
    expect(rows[0][7]).toBe(100_000);
    expect(rows[2][7]).toBe(0);
    expect(rows[2][10]).toBe('Khách đổi ý');
    expect(rows[3][0]).toBe('TỔNG');
    expect(rows[3][2]).toBe('2/3 đơn giao thành công');
    expect(rows[3][7]).toBe(150_000);
    expect(rows[3][9]).toBe(150_000);
  });

  it('không có đơn: vẫn có dòng TỔNG bằng 0', () => {
    expect(restaurantRevenueRows([])).toEqual([['TỔNG', '', '0/0 đơn giao thành công', '', '', '', '', 0, 0, 0, '']]);
  });

  it('maskName', () => {
    expect(maskName('Peter')).toBe('Peter');
    expect(maskName('  Trần   Minh Khoa ')).toBe('Trần M. K.');
    expect(maskName('')).toBe('Khách hàng');
  });

  it('doanh thu quán trừ phần voucher do quán chịu', () => {
    const rows = restaurantRevenueRows([order({ restaurantDiscount: 15_000 })]);
    expect(rows[0].slice(7, 10)).toEqual([100_000, 15_000, 85_000]);
    expect(rows[1].slice(7, 10)).toEqual([100_000, 15_000, 85_000]);
  });
});
