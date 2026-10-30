import React from 'react';
import { View } from 'react-native';
import { AuditLogEntry } from '../../../api/admin';
import { Badge, BadgeTone, cn, Icon, IconName, IconTone, Text } from '../../ui';
import { Role, RoleRequestStatus } from '../../../types/api';

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
    case 'RESTAURANT_SUSPEND':
      return { icon: 'pause-circle', tone: 'accent', text: `Tạm ngưng quán ${m.restaurantName ?? ''}` };
    case 'RESTAURANT_RESUME':
      return { icon: 'play-circle', tone: 'success', text: `Mở lại quán ${m.restaurantName ?? ''}` };
    default:
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
