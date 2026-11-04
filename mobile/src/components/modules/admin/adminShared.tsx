import React from 'react';
import { View } from 'react-native';
import { AuditLogEntry } from '../../../api/admin';
import { Badge, BadgeTone, cn, Icon, IconName, IconTone, Text } from '../../ui';
import { OrderStatus, RestaurantStatus, Role, RoleRequestStatus } from '../../../types/api';
import { ORDER_STEP_LABEL } from '../../../utils/adminOrder';
import { formatVND, orderCode } from '../../../utils/format';

export const RESTAURANT_STATUS_META: Record<RestaurantStatus, { label: string; tone: BadgeTone }> = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warning' },
  ACTIVE: { label: 'Đã duyệt', tone: 'success' },
  SUSPENDED: { label: 'Tạm khoá', tone: 'danger' },
};

export const ROLE_META: Record<Role, { label: string; tone: BadgeTone; icon: IconName }> = {
  CUSTOMER: { label: 'Khách hàng', tone: 'neutral', icon: 'person-outline' },
  RESTAURANT_OWNER: { label: 'Chủ quán', tone: 'warning', icon: 'storefront-outline' },
  DRIVER: { label: 'Tài xế', tone: 'success', icon: 'bicycle-outline' },
  ADMIN: { label: 'Quản trị viên', tone: 'danger', icon: 'shield-checkmark-outline' },
};

export const RoleBadge: React.FC<{ role: Role; className?: string }> = ({ role, className }) => (
  <Badge label={ROLE_META[role].label} tone={ROLE_META[role].tone} icon={ROLE_META[role].icon} className={className} />
);

export const REQUEST_STATUS_META: Record<RoleRequestStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  REJECTED: { label: 'Từ chối', tone: 'danger' },
};

const VEHICLE_LABEL: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  ELECTRIC_MOTORBIKE: 'Xe máy điện',
  BICYCLE: 'Xe đạp',
};
export const vehicleLabel = (t?: string | null) => (t ? VEHICLE_LABEL[t] ?? t : 'Chưa khai báo');

/** Câu mô tả ngắn cho một dòng nhật ký quản trị. */
export function describeAudit(log: AuditLogEntry): { icon: IconName; tone: IconTone; text: string } {
  const m = log.metadata ?? {};
  const roleName = (r?: string) => (r && r in ROLE_META ? ROLE_META[r as Role].label : r ?? '');
  switch (log.action) {
    case 'USER_LOCK':
      return { icon: 'lock-closed', tone: 'danger', text: `Khoá tài khoản${m.reason ? ` – lý do: ${m.reason}` : ''}` };
    case 'USER_UNLOCK':
      return { icon: 'lock-open', tone: 'success', text: 'Mở khoá tài khoản' };
    case 'USER_CHANGE_ROLE':
      return {
        icon: 'swap-horizontal',
        tone: 'brand',
        text: `Đổi vai trò ${roleName(m.from)} → ${roleName(m.to)}${
          m.via === 'ASSIGN_RESTAURANT' ? ` (nhận quán ${m.restaurantName ?? ''})` : ''
        }`,
      };
    case 'ROLE_REQUEST_APPROVED':
      return { icon: 'checkmark-circle', tone: 'success', text: `Duyệt yêu cầu làm ${roleName(m.requestedRole)}` };
    case 'ROLE_REQUEST_REJECTED':
      return {
        icon: 'close-circle',
        tone: 'danger',
        text: `Từ chối yêu cầu làm ${roleName(m.requestedRole)}${m.reviewNote ? ` – ${m.reviewNote}` : ''}`,
      };
    case 'RESTAURANT_ASSIGN_OWNER':
      return {
        icon: 'key',
        tone: 'brand',
        text: `Bàn giao "${m.restaurantName ?? 'quán'}": ${m.fromOwnerName ?? '?'} → ${m.toOwnerName ?? '?'}`,
      };
    case 'RESTAURANT_APPROVE':
      return { icon: 'checkmark-circle', tone: 'success', text: `Duyệt quán ${m.restaurantName ?? ''}` };
    case 'RESTAURANT_REJECT':
      return {
        icon: 'close-circle',
        tone: 'danger',
        text: `Từ chối quán ${m.restaurantName ?? ''}${log.reason || m.reason ? ` – ${log.reason || m.reason}` : ''}`,
      };
    case 'RESTAURANT_SUSPEND':
      return {
        icon: 'pause-circle',
        tone: 'accent',
        text: `Tạm khoá quán ${m.restaurantName ?? ''}${log.reason || m.reason ? ` – ${log.reason || m.reason}` : ''}`,
      };
    case 'RESTAURANT_RESUME':
      return { icon: 'play-circle', tone: 'success', text: `Mở lại quán ${m.restaurantName ?? ''}` };
    case 'RESTAURANT_CRITICAL_EDIT_REAPPROVAL':
      return { icon: 'create-outline', tone: 'accent', text: 'Chủ quán sửa tên/địa chỉ/toạ độ → chờ duyệt lại' };
    case 'RESTAURANT_CREATE':
      return { icon: 'add-circle', tone: 'success', text: `Tạo quán ${m.name ?? m.restaurantName ?? ''}` };
    case 'RESTAURANT_UPDATE':
      return { icon: 'create-outline', tone: 'brand', text: `Sửa thông tin quán ${m.restaurantName ?? ''}` };
    case 'RESTAURANT_DELETE':
      return { icon: 'trash', tone: 'danger', text: `Xoá quán ${m.restaurantName ?? ''}` };
    case 'MENU_ITEM_DELETE':
      return { icon: 'trash-outline', tone: 'danger', text: `Gỡ món "${m.name ?? ''}"` };
    case 'USER_CREATE':
      return { icon: 'person-add', tone: 'success', text: `Tạo tài khoản ${m.email ?? ''} (${roleName(m.role)})` };
    case 'REVIEW_HIDE':
      return { icon: 'eye-off', tone: 'accent', text: `Ẩn đánh giá${m.reason ? ` – ${m.reason}` : ''}` };
    case 'REVIEW_SHOW':
      return { icon: 'eye', tone: 'success', text: 'Hiện lại đánh giá' };
    case 'ORDER_UNASSIGN_DRIVER':
      return { icon: 'person-remove', tone: 'accent', text: `Gỡ tài xế khỏi đơn #${orderCode(log.targetId)}${m.reason ? ` – ${m.reason}` : ''}` };
    case 'DRIVER_SETTLEMENT':
      return {
        icon: 'cash',
        tone: 'success',
        text: `Ghi nhận tài xế nộp ${formatVND(Number(m.amount ?? 0))} tiền COD${m.note ? ` – ${m.note}` : ''}`,
      };
    case 'DRIVER_LEDGER_ADJUSTMENT':
      return { icon: 'calculator', tone: 'brand', text: `Điều chỉnh công nợ tài xế${m.note || m.reason ? ` – ${m.note || m.reason}` : ''}` };
    case 'DRIVER_RELEASE_ORDER':
      return { icon: 'return-up-back', tone: 'accent', text: `Tài xế trả lại đơn #${orderCode(log.targetId)}` };
    case 'EXPORT_ORDERS_CSV':
      return { icon: 'download', tone: 'brand', text: `Xuất CSV đơn hàng ${m.from ?? ''} → ${m.to ?? ''} (${m.rows ?? 0} đơn)` };
    case 'EXPORT_REVENUE_CSV':
      return {
        icon: 'download',
        tone: 'accent',
        text: `Xuất CSV doanh thu ${m.restaurantName ?? 'quán'} ${m.from ?? ''} → ${m.to ?? ''}`,
      };
    case 'BANNER_CREATE':
      return { icon: 'images', tone: 'success', text: 'Thêm banner mới' };
    case 'BANNER_UPDATE':
      return { icon: 'images-outline', tone: 'brand', text: 'Sửa banner' };
    case 'BANNER_DELETE':
      return { icon: 'images-outline', tone: 'danger', text: 'Xoá banner' };
    case 'BANNER_REORDER':
      return { icon: 'swap-vertical', tone: 'brand', text: 'Sắp xếp lại banner' };
    case 'CUISINE_CREATE':
      return { icon: 'grid', tone: 'success', text: 'Thêm danh mục ẩm thực' };
    case 'CUISINE_UPDATE':
      return { icon: 'grid-outline', tone: 'brand', text: 'Sửa danh mục ẩm thực' };
    case 'CUISINE_DELETE':
      return { icon: 'grid-outline', tone: 'danger', text: 'Xoá danh mục ẩm thực' };
    case 'CUISINE_REORDER':
      return { icon: 'swap-vertical', tone: 'brand', text: 'Sắp xếp lại danh mục ẩm thực' };
    default:
      if (log.action.startsWith('ORDER_STATUS_')) {
        const to = log.action.replace('ORDER_STATUS_', '') as OrderStatus;
        return {
          icon: to === 'CANCELLED' ? 'close-circle' : 'swap-horizontal',
          tone: to === 'CANCELLED' ? 'danger' : 'brand',
          text: `${to === 'CANCELLED' ? 'Huỷ' : `Chuyển sang "${ORDER_STEP_LABEL[to] ?? to}" cho`} đơn #${orderCode(log.targetId)}${
            m.cancelNote ? ` – ${m.cancelNote}` : ''
          }`,
        };
      }
      return { icon: 'ellipse-outline', tone: 'muted', text: log.action };
  }
}

/** Dòng "nhãn — giá trị" trong các thẻ chi tiết. */
export const InfoRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({
  label,
  value,
  className,
}) => (
  <View className={cn('flex-row items-start justify-between gap-3 py-1.5', className)}>
    <Text variant="body" tone="secondary">
      {label}
    </Text>
    {typeof value === 'string' || typeof value === 'number' ? (
      <Text variant="body" weight="medium" className="flex-1 text-right">
        {value}
      </Text>
    ) : (
      value
    )}
  </View>
);

/** Thẻ khối nội dung bo 2xl, bóng nhẹ, đồng bộ với thẻ ở Trang chủ. */
export const SectionCard: React.FC<{
  title?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, trailing, children, className }) => (
  <View className={cn('gap-2 rounded-2xl bg-surface p-4 shadow-card', className)}>
    {!!title && (
      <View className="flex-row items-center gap-2">
        {icon && <Icon name={icon} size="sm" tone="brand" />}
        <Text variant="headline" className="flex-1">
          {title}
        </Text>
        {trailing}
      </View>
    )}
    {children}
  </View>
);
