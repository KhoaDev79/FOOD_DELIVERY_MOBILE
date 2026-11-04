import { CancelReason } from '@prisma/client';
import {
  actorMayTransition,
  isValidTransition,
  validateCancellationInput,
} from './order-state-machine';

describe('order-state-machine (V4)', () => {
  it('từ chối các cạnh nằm ngoài đồ thị trạng thái đối với mọi actor (kể cả ADMIN)', () => {
    expect(isValidTransition('PENDING', 'DELIVERED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'PENDING', 'DELIVERED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'DELIVERED', 'CANCELLED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'DELIVERY_FAILED', 'CANCELLED')).toBe(false);
    expect(actorMayTransition('ADMIN', 'CANCELLED', 'CONFIRMED')).toBe(false);
  });

  it('OWNER vận hành luồng bếp và huỷ đơn theo đúng điều kiện', () => {
    expect(actorMayTransition('OWNER', 'PENDING', 'CONFIRMED')).toBe(true);
    expect(actorMayTransition('OWNER', 'CONFIRMED', 'PREPARING')).toBe(true);
    expect(actorMayTransition('OWNER', 'PREPARING', 'READY_FOR_PICKUP')).toBe(true);
    expect(actorMayTransition('OWNER', 'READY_FOR_PICKUP', 'PICKED_UP')).toBe(false);

    // Huỷ ở PENDING / CONFIRMED với các lý do nhà hàng
    expect(actorMayTransition('OWNER', 'PENDING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('OWNER', 'CONFIRMED', 'CANCELLED')).toBe(true);
    expect(
      validateCancellationInput('OWNER', 'CONFIRMED', CancelReason.RESTAURANT_CLOSED),
    ).toBeNull();
    expect(
      validateCancellationInput('OWNER', 'CONFIRMED', CancelReason.RESTAURANT_TIMEOUT),
    ).not.toBeNull();

    // Huỷ ở PREPARING chỉ cho phép RESTAURANT_OUT_OF_STOCK
    expect(
      actorMayTransition('OWNER', 'PREPARING', 'CANCELLED', CancelReason.RESTAURANT_OUT_OF_STOCK),
    ).toBe(true);
    expect(
      actorMayTransition('OWNER', 'PREPARING', 'CANCELLED', CancelReason.RESTAURANT_CLOSED),
    ).toBe(false);
    expect(
      validateCancellationInput('OWNER', 'PREPARING', CancelReason.RESTAURANT_OUT_OF_STOCK),
    ).toBeNull();
    expect(
      validateCancellationInput('OWNER', 'PREPARING', CancelReason.RESTAURANT_CLOSED),
    ).not.toBeNull();

    // Không được huỷ khi đã READY_FOR_PICKUP hoặc PICKED_UP
    expect(actorMayTransition('OWNER', 'READY_FOR_PICKUP', 'CANCELLED')).toBe(false);
    expect(actorMayTransition('OWNER', 'PICKED_UP', 'CANCELLED')).toBe(false);
  });

  it('DRIVER chỉ xử lý lấy món, giao thành công hoặc giao thất bại (từ PICKED_UP)', () => {
    expect(actorMayTransition('DRIVER', 'READY_FOR_PICKUP', 'PICKED_UP')).toBe(true);
    expect(actorMayTransition('DRIVER', 'PICKED_UP', 'DELIVERED')).toBe(true);
    expect(actorMayTransition('DRIVER', 'PICKED_UP', 'DELIVERY_FAILED')).toBe(true);
    expect(actorMayTransition('DRIVER', 'READY_FOR_PICKUP', 'DELIVERY_FAILED')).toBe(false);
    expect(actorMayTransition('DRIVER', 'PENDING', 'CONFIRMED')).toBe(false);
    expect(actorMayTransition('DRIVER', 'CONFIRMED', 'CANCELLED')).toBe(false);
  });

  it('CUSTOMER chỉ được huỷ khi PENDING với lý do CUSTOMER_CHANGED_MIND', () => {
    expect(actorMayTransition('CUSTOMER', 'PENDING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('CUSTOMER', 'CONFIRMED', 'CANCELLED')).toBe(false);
    expect(actorMayTransition('CUSTOMER', 'PENDING', 'CONFIRMED')).toBe(false);
    expect(
      validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.CUSTOMER_CHANGED_MIND),
    ).toBeNull();
    expect(
      validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.RESTAURANT_CLOSED),
    ).not.toBeNull();
  });

  it('CUSTOMER chọn được các lý do của khách; "Lý do khác" bắt buộc ghi chú', () => {
    expect(validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.CUSTOMER_WRONG_ADDRESS)).toBeNull();
    expect(validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.CUSTOMER_WAIT_TOO_LONG)).toBeNull();
    expect(validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.CUSTOMER_OTHER)).toContain('ghi rõ lý do');
    expect(validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.CUSTOMER_OTHER, 'Bận việc đột xuất')).toBeNull();
    expect(validateCancellationInput('CUSTOMER', 'PENDING', CancelReason.ADMIN_INTERVENTION)).not.toBeNull();
  });

  it('SYSTEM chỉ được tự động huỷ đơn PENDING với lý do RESTAURANT_TIMEOUT', () => {
    expect(actorMayTransition('SYSTEM', 'PENDING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('SYSTEM', 'CONFIRMED', 'CANCELLED')).toBe(false);
    expect(
      validateCancellationInput('SYSTEM', 'PENDING', CancelReason.RESTAURANT_TIMEOUT),
    ).toBeNull();
  });

  it('ADMIN được huỷ đơn ở mọi trạng thái chưa kết thúc nhưng bắt buộc ADMIN_INTERVENTION và cancelNote', () => {
    expect(actorMayTransition('ADMIN', 'PENDING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('ADMIN', 'CONFIRMED', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('ADMIN', 'PREPARING', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('ADMIN', 'READY_FOR_PICKUP', 'CANCELLED')).toBe(true);
    expect(actorMayTransition('ADMIN', 'PICKED_UP', 'CANCELLED')).toBe(true);

    expect(
      validateCancellationInput('ADMIN', 'PICKED_UP', CancelReason.ADMIN_INTERVENTION, ''),
    ).not.toBeNull();
    expect(
      validateCancellationInput(
        'ADMIN',
        'PICKED_UP',
        CancelReason.ADMIN_INTERVENTION,
        'Khách báo sự cố khẩn cấp',
      ),
    ).toBeNull();
  });
});
