import { OrderStatus } from '../types/api';
import { colors } from '../constants/colors';

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; step: number }
> = {
  PENDING: {
    label: 'Chờ xác nhận',
    color: colors.warning,
    bgColor: '#FEF3C7',
    step: 0,
  },
  CONFIRMED: {
    label: 'Đã nhận đơn',
    color: colors.info,
    bgColor: '#DBEAFE',
    step: 1,
  },
  PREPARING: {
    label: 'Đang chuẩn bị món',
    color: colors.info,
    bgColor: '#DBEAFE',
    step: 2,
  },
  READY_FOR_PICKUP: {
    label: 'Chờ tài xế lấy',
    color: colors.secondary,
    bgColor: '#CCFBF1',
    step: 3,
  },
  PICKED_UP: {
    label: 'Đang giao hàng',
    color: colors.primary,
    bgColor: colors.primaryLight,
    step: 4,
  },
  DELIVERED: {
    label: 'Giao thành công',
    color: colors.success,
    bgColor: '#D1FAE5',
    step: 5,
  },
  CANCELLED: {
    label: 'Đã hủy',
    color: colors.danger,
    bgColor: '#FEE2E2',
    step: -1,
  },
};

export const ORDER_STEPS = [
  { key: 'PENDING', label: 'Chờ quán nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PREPARING', label: 'Đang làm món' },
  { key: 'READY_FOR_PICKUP', label: 'Chờ lấy' },
  { key: 'PICKED_UP', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Hoàn thành' },
];

