import { CANCEL_REASON_VI, CsvValue, ORDER_STATUS_VI, vnDateTime } from './csv.util';

const code = (id: string) => id.slice(0, 8).toUpperCase();
const PAYMENT_VI: Record<string, string> = { COD: 'Tiền mặt', VNPAY: 'VNPay' };
const PAYMENT_STATUS_VI: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
  REFUNDED: 'Đã hoàn tiền',
  REFUND_PENDING: 'Chờ hoàn tiền',
};

export interface ExportOrder {
  id: string;
  createdAt: Date;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  peakSurcharge: number;
  discountAmount: number;
  shippingDiscount?: number;
  restaurantDiscount?: number;
  voucherCode?: string | null;
  freeshipVoucherCode?: string | null;
  total: number;
  platformCommission: number;
  driverEarning: number;
  distanceKm: number;
  cancelReason: string | null;
  failedReason: string | null;
  cancelNote: string | null;
  restaurant: { name: string };
  customer: { fullName: string; phone: string | null };
  driver: { fullName: string } | null;
  items: { name: string; quantity: number }[];
}

const itemCount = (o: ExportOrder) => o.items.reduce((s, i) => s + i.quantity, 0);
const endReason = (o: ExportOrder) => {
  const key = o.status === 'DELIVERY_FAILED' ? o.failedReason : o.status === 'CANCELLED' ? o.cancelReason : null;
  return key ? (CANCEL_REASON_VI[key] ?? key) : '';
};

export const ADMIN_ORDER_HEADERS = [
  'Mã đơn',
  'Thời gian đặt',
  'Trạng thái',
  'Quán',
  'Khách hàng',
  'SĐT khách',
  'Tài xế',
  'Thanh toán',
  'TT thanh toán',
  'Số món',
  'Tiền món',
  'Phí giao',
  'Phụ phí cao điểm',
  'Giảm tiền món',
  'Giảm phí ship',
  'Mã voucher',
  'Quán chịu giảm',
  'Tổng thanh toán',
  'Phí sàn (trên phí giao)',
  'Thu nhập tài xế',
  'Quãng đường (km)',
  'Lý do huỷ / thất bại',
  'Ghi chú huỷ',
];

/** Toàn bộ đơn trong kỳ (mọi trạng thái) cho admin đối chiếu. */
export function adminOrderRows(orders: ExportOrder[]): CsvValue[][] {
  return orders.map((o) => [
    code(o.id),
    vnDateTime(o.createdAt),
    ORDER_STATUS_VI[o.status] ?? o.status,
    o.restaurant.name,
    o.customer.fullName,
    o.customer.phone ?? '',
    o.driver?.fullName ?? '',
    PAYMENT_VI[o.paymentMethod] ?? o.paymentMethod,
    PAYMENT_STATUS_VI[o.paymentStatus] ?? o.paymentStatus,
    itemCount(o),
    o.subtotal,
    o.deliveryFee,
    o.peakSurcharge,
    o.discountAmount,
    o.shippingDiscount ?? 0,
    [o.voucherCode, o.freeshipVoucherCode].filter(Boolean).join(', '),
    o.restaurantDiscount ?? 0,
    o.total,
    o.platformCommission,
    o.driverEarning,
    Math.round(o.distanceKm * 10) / 10,
    endReason(o),
    o.cancelNote ?? '',
  ]);
}

export const RESTAURANT_REVENUE_HEADERS = [
  'Mã đơn',
  'Thời gian đặt',
  'Trạng thái',
  'Khách hàng',
  'Món',
  'Số món',
  'Thanh toán',
  'Tiền món',
  'Voucher quán chịu',
  'Doanh thu thực nhận',
  'Lý do huỷ / thất bại',
];

/** "Nguyễn Văn An" → "Nguyễn V. A.": quán không cần tên đầy đủ của khách trong báo cáo. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? 'Khách hàng';
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(' ')}`;
}

/**
 * Báo cáo doanh thu của quán: mỗi đơn một dòng + dòng TỔNG.
 * Chỉ đơn giao thành công mới tính tiền (đơn huỷ/thất bại vẫn liệt kê để quán đối chiếu, tiền = 0).
 * Doanh thu quán = tiền món − voucher do quán phát hành (sàn chưa thu % trên tiền món; voucher của sàn
 * do sàn chịu nên không trừ). Cùng định nghĩa với màn Thống kê của chủ quán.
 */
export function restaurantRevenueRows(orders: ExportOrder[]): CsvValue[][] {
  let subtotal = 0;
  let funded = 0;
  let net = 0;
  let delivered = 0;
  const rows: CsvValue[][] = orders.map((o) => {
    const done = o.status === 'DELIVERED';
    const sub = done ? o.subtotal : 0;
    const disc = done ? (o.restaurantDiscount ?? 0) : 0;
    if (done) {
      subtotal += sub;
      funded += disc;
      net += sub - disc;
      delivered++;
    }
    return [
      code(o.id),
      vnDateTime(o.createdAt),
      ORDER_STATUS_VI[o.status] ?? o.status,
      maskName(o.customer.fullName),
      o.items.map((i) => `${i.quantity}x ${i.name}`).join('; '),
      itemCount(o),
      PAYMENT_VI[o.paymentMethod] ?? o.paymentMethod,
      sub,
      disc,
      sub - disc,
      endReason(o),
    ];
  });
  rows.push([
    'TỔNG',
    '',
    `${delivered}/${orders.length} đơn giao thành công`,
    '',
    '',
    '',
    '',
    subtotal,
    funded,
    net,
    '',
  ]);
  return rows;
}
