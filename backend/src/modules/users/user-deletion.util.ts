import { Role } from '@prisma/client';

export interface CanDeleteAccountParams {
  role: Role;
  activeCustomerOrdersCount: number;
  activeDriverOrdersCount: number;
  activeRestaurantOrdersCount: number;
  driverCodBalance?: number;
}

export interface CanDeleteAccountResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Kiểm tra các điều kiện an toàn trước khi cho phép xoá tài khoản:
 * 1. Khách hàng/tài xế/chủ quán không được có đơn hàng đang trong tiến trình xử lý hoặc đang giao.
 * 2. Tài xế không được còn công nợ COD chưa thanh toán/đối soát với hệ thống.
 */
export function canDeleteUserAccount(params: CanDeleteAccountParams): CanDeleteAccountResult {
  if (params.activeCustomerOrdersCount > 0) {
    return {
      allowed: false,
      reason: 'Bạn đang có đơn hàng chưa hoàn tất. Vui lòng chờ đơn hoàn thành hoặc huỷ đơn trước khi xoá tài khoản.',
    };
  }

  if (params.role === Role.DRIVER) {
    if (params.activeDriverOrdersCount > 0) {
      return {
        allowed: false,
        reason: 'Tài xế đang có đơn hàng nhận giao chưa hoàn tất. Vui lòng hoàn thành đơn trước khi xoá tài khoản.',
      };
    }

    if (params.driverCodBalance && params.driverCodBalance > 0) {
      return {
        allowed: false,
        reason: `Tài xế còn công nợ COD chưa thanh toán (${params.driverCodBalance.toLocaleString('vi-VN')} ₫). Vui lòng đối soát và nộp hết công nợ trước khi xoá tài khoản.`,
      };
    }
  }

  if (params.role === Role.RESTAURANT_OWNER) {
    if (params.activeRestaurantOrdersCount > 0) {
      return {
        allowed: false,
        reason: 'Quán ăn của bạn đang có đơn hàng đang xử lý. Vui lòng hoàn tất xử lý hết đơn trước khi xoá tài khoản.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Tạo email ẩn danh duy nhất để giải phóng email gốc cho người dùng đăng ký lại nếu muốn,
 * đồng thời xoá bỏ thông tin định danh cá nhân tuân thủ chính sách App Store / Google Play.
 */
export function generateAnonymizedEmail(userId: string, timestamp = Date.now()): string {
  const shortId = userId.replace(/-/g, '').slice(0, 8);
  return `deleted_${timestamp}_${shortId}@deleted.zomzom.local`;
}

