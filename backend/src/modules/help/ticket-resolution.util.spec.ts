import { SupportTicketPriority } from '@prisma/client';
import {
  calculateTicketPriority,
  decideResolution,
  DEFAULT_RESOLUTION_CONFIG,
  IssueInput,
  OrderInput,
} from './ticket-resolution.util';

describe('ticket-resolution.util', () => {
  const baseOrder: OrderInput = {
    id: 'ord-123',
    status: 'DELIVERED',
    total: 120_000,
    paymentMethod: 'COD',
    createdAt: new Date('2026-11-03T10:00:00Z'),
    deliveredAt: new Date('2026-11-03T10:45:00Z'),
  };

  describe('calculateTicketPriority', () => {
    it('đơn đang giao có độ ưu tiên URGENT', () => {
      const activeOrder: OrderInput = { ...baseOrder, status: 'PICKED_UP' };
      expect(calculateTicketPriority(activeOrder)).toBe(SupportTicketPriority.URGENT);
    });

    it('đơn đã giao trong vòng 2 giờ có độ ưu tiên HIGH', () => {
      const deliveredRecently: OrderInput = {
        ...baseOrder,
        status: 'DELIVERED',
        deliveredAt: new Date('2026-11-03T10:00:00Z'),
      };
      const now = new Date('2026-11-03T11:00:00Z'); // 1 giờ sau giao
      expect(calculateTicketPriority(deliveredRecently, now)).toBe(SupportTicketPriority.HIGH);
    });

    it('đơn đã giao quá 2 giờ có độ ưu tiên NORMAL', () => {
      const deliveredLongAgo: OrderInput = {
        ...baseOrder,
        status: 'DELIVERED',
        deliveredAt: new Date('2026-11-03T07:00:00Z'),
      };
      const now = new Date('2026-11-03T11:00:00Z'); // 4 giờ sau giao
      expect(calculateTicketPriority(deliveredLongAgo, now)).toBe(SupportTicketPriority.NORMAL);
    });

    it('không có đơn hàng thì ưu tiên NORMAL', () => {
      expect(calculateTicketPriority(null)).toBe(SupportTicketPriority.NORMAL);
    });
  });

  describe('decideResolution', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    // Cấu hình khi đã có hệ thống Voucher (bật bồi thường tự động)
    const AUTO_ON = { ...DEFAULT_RESOLUTION_CONFIG, autoCompensationEnabled: true };

    it('yêu cầu huỷ khi đơn PENDING -> hướng dẫn tự huỷ, KHÔNG báo đã huỷ', () => {
      const pendingOrder: OrderInput = { ...baseOrder, status: 'PENDING' };
      const issue: IssueInput = { type: 'CANCEL_REQUEST', description: 'Đặt nhầm địa chỉ' };

      const res = decideResolution(issue, pendingOrder, null, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('INFO_ONLY');
      expect(res.suggestedAction).toContain('tự huỷ');
    });

    it('yêu cầu huỷ khi quán đã nhận (PREPARING) -> chuyển CSKH liên hệ quán, ưu tiên cao', () => {
      const preparingOrder: OrderInput = { ...baseOrder, status: 'PREPARING' };
      const issue: IssueInput = { type: 'CANCEL_REQUEST', description: 'Đổi ý không ăn nữa' };

      const res = decideResolution(issue, preparingOrder, null, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
      expect(res.priority).toBe(SupportTicketPriority.HIGH);
      expect(res.suggestedAction).toContain('Liên hệ quán');
    });

    it('báo trễ > 20 phút và khách uy tín -> tự động tặng voucher xin lỗi 10.000₫', () => {
      const lateOrder: OrderInput = {
        ...baseOrder,
        status: 'PICKED_UP',
        estimatedDeliveryAt: new Date('2026-11-03T11:20:00Z'), // Trễ 40 phút so với now=12:00
      };
      const issue: IssueInput = { type: 'DELAYED_ORDER', description: 'Chờ quá lâu chưa thấy đồ ăn' };
      const history = { completedOrdersCount: 5, complaintsCountLast30Days: 0 };

      const res = decideResolution(issue, lateOrder, history, AUTO_ON, now);
      expect(res.decision).toBe('AUTO_COMPENSATE');
      expect(res.compensationAmount).toBe(10_000);
      expect(res.compensationType).toBe('VOUCHER');
    });

    it('báo thiếu món <= 50.000₫, khách >= 3 đơn hoàn tất -> tự động bồi thường voucher', () => {
      const issue: IssueInput = {
        type: 'MISSING_ITEMS',
        description: 'Quán quên giao phần canh',
        affectedItems: [{ name: 'Canh rong biển', quantity: 1, price: 30_000 }],
      };
      const history = { completedOrdersCount: 4, complaintsCountLast30Days: 0 };

      const res = decideResolution(issue, baseOrder, history, AUTO_ON, now);
      expect(res.decision).toBe('AUTO_COMPENSATE');
      expect(res.compensationAmount).toBe(30_000);
      expect(res.compensationType).toBe('VOUCHER');
    });

    it('mặc định (chưa có Voucher): đủ điều kiện vẫn chờ CSKH duyệt, kèm đề xuất số tiền', () => {
      const issue: IssueInput = {
        type: 'MISSING_ITEMS',
        description: 'Quán quên giao phần canh',
        affectedItems: [{ name: 'Canh rong biển', quantity: 1, price: 30_000 }],
      };
      const history = { completedOrdersCount: 4, complaintsCountLast30Days: 0 };

      const res = decideResolution(issue, baseOrder, history, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
      expect(res.compensationAmount).toBe(30_000);
      expect(res.suggestedAction).toContain('chờ CSKH duyệt');
    });

    it('mặc định: đơn trễ cũng không tự hứa voucher', () => {
      const lateOrder: OrderInput = {
        ...baseOrder,
        status: 'PICKED_UP',
        estimatedDeliveryAt: new Date('2026-11-03T11:20:00Z'),
      };
      const issue: IssueInput = { type: 'DELAYED_ORDER', description: 'Chờ lâu' };
      const res = decideResolution(issue, lateOrder, { completedOrdersCount: 5, complaintsCountLast30Days: 0 }, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
    });

    it('báo thiếu món > 50.000₫ -> NEEDS_REVIEW', () => {
      const issue: IssueInput = {
        type: 'MISSING_ITEMS',
        description: 'Thiếu phần gà cay',
        affectedItems: [{ name: 'Gà nướng cay', quantity: 1, price: 85_000 }],
      };
      const history = { completedOrdersCount: 4, complaintsCountLast30Days: 0 };

      const res = decideResolution(issue, baseOrder, history, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
      expect(res.reason).toContain('vượt hạn mức');
    });

    it('khách có tỷ lệ khiếu nại cao (>= 3 lần / 30 ngày) -> chuyển NEEDS_REVIEW', () => {
      const issue: IssueInput = {
        type: 'MISSING_ITEMS',
        description: 'Thiếu trà đá',
        affectedItems: [{ name: 'Trà đá', quantity: 1, price: 10_000 }],
      };
      const frequentComplainer = { completedOrdersCount: 10, complaintsCountLast30Days: 4 };

      const res = decideResolution(issue, baseOrder, frequentComplainer, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
      expect(res.reason).toContain('tỷ lệ khiếu nại cao');
    });

    it('món bị đổ/hỏng bắt buộc nhân viên thẩm định bằng chứng ảnh', () => {
      const issue: IssueInput = {
        type: 'DAMAGED_ITEMS',
        description: 'Bát bún bị nghiêng đổ nước dùng ra túi',
      };
      const res = decideResolution(issue, baseOrder, null, DEFAULT_RESOLUTION_CONFIG, now);
      expect(res.decision).toBe('NEEDS_REVIEW');
      expect(res.suggestedAction).toContain('kiểm tra hình ảnh');
    });
  });
});
