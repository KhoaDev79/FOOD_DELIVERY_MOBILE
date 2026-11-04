import { SupportTicketPriority } from '@prisma/client';

export type IssueType =
  | 'DELAYED_ORDER'
  | 'CANCEL_REQUEST'
  | 'CONTACT_PARTY'
  | 'MISSING_ITEMS'
  | 'WRONG_ITEMS'
  | 'DAMAGED_ITEMS'
  | 'FOOD_QUALITY'
  | 'DRIVER_ATTITUDE'
  | 'WRONG_PRICE'
  | 'NOT_MY_CANCELLATION'
  | 'QUESTION_ABOUT_CANCELLATION'
  | 'GENERAL_SUPPORT';

export interface AffectedItemInput {
  name: string;
  quantity: number;
  price: number;
}

export interface IssueInput {
  type: IssueType;
  description: string;
  affectedItems?: AffectedItemInput[];
  attachmentsCount?: number;
}

export interface OrderInput {
  id: string;
  code?: string;
  status: string; // PENDING, CONFIRMED, PREPARING, READY_FOR_PICKUP, PICKED_UP, DELIVERED, CANCELLED, FAILED
  total: number;
  paymentMethod: string;
  createdAt: Date;
  estimatedDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
}

export interface CustomerHistoryInput {
  completedOrdersCount: number;
  lastAutoCompensatedAt?: Date | null;
  complaintsCountLast30Days: number;
}

export interface ResolutionConfig {
  autoCompensateLimitVnd: number; // Mặc định 50.000₫
  lateThresholdMinutes: number; // Mặc định trễ quá 20 phút
  maxComplaintsBeforeReview: number; // Mặc định 3 lần khiếu nại trong 30 ngày
  /**
   * Cho phép tự động tặng voucher bồi thường. TẮT cho tới khi có hệ thống Voucher thật:
   * nếu bật khi chưa phát được voucher thì khách bị hứa một thứ không bao giờ nhận được.
   * Khi tắt, trường hợp đủ điều kiện vẫn được ghi "đề xuất bồi thường" để nhân viên duyệt.
   */
  autoCompensationEnabled: boolean;
}

export const DEFAULT_RESOLUTION_CONFIG: ResolutionConfig = {
  autoCompensateLimitVnd: 50_000,
  lateThresholdMinutes: 20,
  maxComplaintsBeforeReview: 3,
  autoCompensationEnabled: false,
};

export type ResolutionDecision = 'AUTO_COMPENSATE' | 'NEEDS_REVIEW' | 'INFO_ONLY';

export interface TicketResolutionResult {
  decision: ResolutionDecision;
  priority: SupportTicketPriority;
  suggestedAction: string;
  compensationAmount?: number;
  compensationType?: 'VOUCHER' | 'REFUND_PENDING';
  reason: string;
}

/**
 * Tính toán độ ưu tiên của phiếu hỗ trợ dựa trên trạng thái đơn hàng (Đặc tả ĐỢT B):
 * - Đơn đang giao -> URGENT / HIGH
 * - Đã giao trong 2 giờ -> HIGH
 * - Còn lại -> NORMAL
 */
export function calculateTicketPriority(order?: OrderInput | null, now = new Date()): SupportTicketPriority {
  if (!order) return SupportTicketPriority.NORMAL;

  const activeStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];
  if (activeStatuses.includes(order.status)) {
    return SupportTicketPriority.URGENT;
  }

  if (order.status === 'DELIVERED') {
    const deliveredTime = order.deliveredAt ? new Date(order.deliveredAt).getTime() : new Date(order.createdAt).getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (now.getTime() - deliveredTime <= twoHoursMs) {
      return SupportTicketPriority.HIGH;
    }
  }

  return SupportTicketPriority.NORMAL;
}

/** Đủ điều kiện bồi thường nhưng chưa được tự động: chuyển nhân viên duyệt, kèm đề xuất số tiền. */
function compensationOrReview(
  config: ResolutionConfig,
  priority: SupportTicketPriority,
  amount: number,
  action: string,
  reason: string,
): TicketResolutionResult {
  if (config.autoCompensationEnabled) {
    return {
      decision: 'AUTO_COMPENSATE',
      priority,
      suggestedAction: action,
      compensationAmount: amount,
      compensationType: 'VOUCHER',
      reason,
    };
  }
  return {
    decision: 'NEEDS_REVIEW',
    priority,
    suggestedAction: `Đề xuất: ${action.charAt(0).toLowerCase()}${action.slice(1)} (chờ CSKH duyệt)`,
    compensationAmount: amount,
    compensationType: 'VOUCHER',
    reason,
  };
}

/**
 * Cây quyết định tự xử lý theo quy tắc (Pure Function - ĐỢT B):
 * - Thiếu/sai món, tổng giá trị <= 50.000₫, khách >= 3 đơn hoàn tất, chưa tự bồi thường 30 ngày -> AUTO_COMPENSATE (Voucher)
 * - Đơn trễ > 20 phút so với estimatedDeliveryAt -> Voucher xin lỗi 10.000₫
 * - Còn lại / vượt hạn mức / khiếu nại nhiều -> NEEDS_REVIEW
 * - Mọi khiếu nại đều ghi vết vào SupportTicket
 */
export function decideResolution(
  issue: IssueInput,
  order?: OrderInput | null,
  history?: CustomerHistoryInput | null,
  config: ResolutionConfig = DEFAULT_RESOLUTION_CONFIG,
  now = new Date(),
): TicketResolutionResult {
  const priority = calculateTicketPriority(order, now);

  if (!order) {
    return {
      decision: 'NEEDS_REVIEW',
      priority: SupportTicketPriority.NORMAL,
      suggestedAction: 'Phân công nhân viên CSKH hỗ trợ tư vấn chung',
      reason: 'Yêu cầu hỗ trợ không gắn với đơn hàng cụ thể',
    };
  }

  const completedOrders = history?.completedOrdersCount ?? 0;
  const complaints = history?.complaintsCountLast30Days ?? 0;
  const hasFrequentComplaints = complaints >= config.maxComplaintsBeforeReview;

  // Kiểm tra thời điểm bồi thường gần nhất
  const isCompensatedRecently = (() => {
    if (!history?.lastAutoCompensatedAt) return false;
    const diffMs = now.getTime() - new Date(history.lastAutoCompensatedAt).getTime();
    return diffMs < 30 * 24 * 60 * 60 * 1000; // trong vòng 30 ngày
  })();

  // 1. Huỷ đơn. Đơn PENDING thì khách tự huỷ ngay trong app (API huỷ đơn), phiếu chỉ để giải thích:
  //    KHÔNG báo "đã huỷ" ở đây vì tạo phiếu không làm thay đổi trạng thái đơn.
  if (issue.type === 'CANCEL_REQUEST') {
    if (order.status === 'PENDING') {
      return {
        decision: 'INFO_ONLY',
        priority: SupportTicketPriority.HIGH,
        suggestedAction: 'Hướng dẫn khách tự huỷ miễn phí trong chi tiết đơn (quán chưa nhận đơn)',
        reason: 'Đơn còn chờ quán xác nhận nên khách tự huỷ được',
      };
    }
    // Quán đã nhận: khách không tự huỷ được, nhân viên liên hệ quán rồi quyết định (huỷ bằng quyền admin)
    return {
      decision: 'NEEDS_REVIEW',
      priority: SupportTicketPriority.HIGH,
      suggestedAction: 'Liên hệ quán: nếu quán chưa làm món hoặc đồng ý thì huỷ đơn bằng quyền admin; nếu không, giải thích cho khách',
      reason: `Khách xin huỷ khi đơn đang ở trạng thái ${order.status} (quán đã nhận)`,
    };
  }

  // 2. Trường hợp trễ đơn (> 20 phút so với dự kiến)
  if (issue.type === 'DELAYED_ORDER' && order.estimatedDeliveryAt) {
    const estTime = new Date(order.estimatedDeliveryAt).getTime();
    const lateMinutes = (now.getTime() - estTime) / (60 * 1000);

    if (lateMinutes >= config.lateThresholdMinutes && !isCompensatedRecently && completedOrders >= 1) {
      return compensationOrReview(
        config,
        priority,
        10_000,
        'Tặng voucher xin lỗi 10.000₫ cho đơn hàng giao trễ',
        `Đơn hàng trễ ${Math.round(lateMinutes)} phút so với dự kiến`,
      );
    }
  }

  // 3. Trường hợp thiếu món hoặc sai món
  if (issue.type === 'MISSING_ITEMS' || issue.type === 'WRONG_ITEMS') {
    const items = issue.affectedItems ?? [];
    const totalAffectedVnd = items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);

    // Điều kiện bồi thường tự động: giá trị <= hạn mức (50k), có uy tín >= 3 đơn, không khiếu nại dày đặc, chưa tự bồi thường gần đây
    const isEligible =
      totalAffectedVnd > 0 &&
      totalAffectedVnd <= config.autoCompensateLimitVnd &&
      completedOrders >= 3 &&
      !hasFrequentComplaints &&
      !isCompensatedRecently;

    if (isEligible) {
      return compensationOrReview(
        config,
        priority,
        totalAffectedVnd,
        `Bồi thường voucher trị giá ${totalAffectedVnd.toLocaleString('vi-VN')}₫`,
        `Khách hàng uy tín (${completedOrders} đơn thành công) báo thiếu/sai món trong hạn mức bồi thường`,
      );
    }

    return {
      decision: 'NEEDS_REVIEW',
      priority,
      suggestedAction: 'CSKH rà soát ảnh đính kèm và đối chiếu xác nhận với Quán',
      compensationAmount: totalAffectedVnd > 0 ? totalAffectedVnd : undefined,
      reason:
        totalAffectedVnd > config.autoCompensateLimitVnd
          ? `Giá trị món bị ảnh hưởng (${totalAffectedVnd.toLocaleString('vi-VN')}₫) vượt hạn mức tự động (${config.autoCompensateLimitVnd.toLocaleString('vi-VN')}₫)`
          : hasFrequentComplaints
          ? 'Tài khoản có tỷ lệ khiếu nại cao trong 30 ngày qua'
          : 'Cần nhân viên kiểm tra hình ảnh bằng chứng trước khi xử lý',
    };
  }

  // 4. Trường hợp đồ ăn bị đổ/hỏng hoặc chất lượng kém
  if (issue.type === 'DAMAGED_ITEMS' || issue.type === 'FOOD_QUALITY') {
    return {
      decision: 'NEEDS_REVIEW',
      priority,
      suggestedAction: 'CSKH kiểm tra hình ảnh chụp đồ ăn hư hỏng và liên hệ tài xế/quán',
      reason: 'Sự cố đồ ăn bị hư hỏng/chất lượng bắt buộc nhân viên thẩm định bằng chứng',
    };
  }

  // 5. Mặc định các trường hợp khác
  return {
    decision: 'NEEDS_REVIEW',
    priority,
    suggestedAction: 'Chuyển hàng đợi CSKH xử lý',
    reason: 'Vấn đề cần nhân viên tư vấn và giải quyết trực tiếp',
  };
}
