import React from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';
import { cn, Icon, IconName, IconTone, Text } from '../../ui';
import { useNow } from '../../../hooks/useNow';
import { palette } from '../../../theme';
import { Restaurant } from '../../../types/api';
import { getStoreStatus, StoreStatusKind } from '../../../utils/openingHours';

/** Màu theo trạng thái quán: xanh lá = nhận đơn, cam = ngoài giờ, đỏ = tạm nghỉ, xám = chưa duyệt. */
const STATUS_STYLE: Record<
  StoreStatusKind,
  { dot: string; box: string; border: string; iconBox: string; icon: IconName; iconTone: IconTone; text: 'success' | 'warning' | 'danger' | 'secondary' }
> = {
  OPEN: {
    dot: 'bg-success',
    box: 'bg-success-soft',
    border: 'border-success/30',
    iconBox: 'bg-success',
    icon: 'storefront',
    iconTone: 'inverse',
    text: 'success',
  },
  OUT_OF_HOURS: {
    dot: 'bg-warning',
    box: 'bg-warning-soft',
    border: 'border-warning/40',
    iconBox: 'bg-warning',
    icon: 'time',
    iconTone: 'inverse',
    text: 'warning',
  },
  PAUSED: {
    dot: 'bg-danger',
    box: 'bg-surface',
    border: 'border-line',
    iconBox: 'bg-danger-soft',
    icon: 'pause',
    iconTone: 'danger',
    text: 'danger',
  },
  NOT_ACTIVE: {
    dot: 'bg-line',
    box: 'bg-surface',
    border: 'border-line',
    iconBox: 'bg-canvas-subtle',
    icon: 'lock-closed',
    iconTone: 'secondary',
    text: 'secondary',
  },
};

/** Nhãn trạng thái thật của quán trên header (tự đổi khi qua giờ đóng/mở cửa). */
export const StoreStatusPill: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => {
  const now = useNow();
  const st = getStoreStatus(restaurant, now);
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5">
      <View className={cn('h-2 w-2 rounded-full', STATUS_STYLE[st.kind].dot)} />
      <Text variant="caption" weight="semibold" tone="inverse" numberOfLines={1}>
        {st.label}
      </Text>
    </View>
  );
};

/**
 * Thẻ trạng thái quán: hiển thị trạng thái THẬT (đang nhận đơn / ngoài giờ / tạm nghỉ),
 * còn công tắc chỉ là "cho phép nhận đơn". Ngoài giờ mà công tắc bật thì quán tự mở lại theo giờ.
 */
export const StoreStatusCard: React.FC<{
  restaurant: Restaurant;
  busy?: boolean;
  onToggle: (value: boolean) => void;
}> = ({ restaurant, busy, onToggle }) => {
  const now = useNow();
  const st = getStoreStatus(restaurant, now);
  const style = STATUS_STYLE[st.kind];
  const canToggle = restaurant.status === 'ACTIVE' || restaurant.status === undefined;

  return (
    <View className={cn('gap-3 rounded-2xl border p-4', style.box, style.border)}>
      <View className="flex-row items-center gap-3">
        <View className={cn('h-12 w-12 items-center justify-center rounded-2xl', style.iconBox)}>
          <Icon name={style.icon} size="lg" tone={style.iconTone} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="micro" tone="muted" className="uppercase">
            Trạng thái quán
          </Text>
          <Text variant="headline" weight="bold" tone={style.text === 'secondary' ? 'default' : style.text}>
            {st.label}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary">
            {st.detail}
          </Text>
        </View>
      </View>

      {canToggle && (
        <View className="flex-row items-center gap-3 rounded-xl bg-surface/80 px-3 py-2.5">
          <View className="flex-1">
            <Text variant="body" weight="semibold">
              Nhận đơn theo giờ mở cửa
            </Text>
            <Text variant="micro" weight="regular" tone="muted">
              {restaurant.isOpen
                ? `Tự mở ${restaurant.openTime || '07:00'} – đóng ${restaurant.closeTime || '22:00'} mỗi ngày`
                : 'Tắt để tạm nghỉ, khách không đặt được món'}
            </Text>
          </View>
          {busy ? (
            <ActivityIndicator color={palette.brand['500']} />
          ) : (
            <Switch
              accessibilityLabel={restaurant.isOpen ? 'Tạm nghỉ, ngừng nhận đơn' : 'Bật nhận đơn theo giờ mở cửa'}
              value={restaurant.isOpen}
              onValueChange={onToggle}
              trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
              thumbColor={palette.surface}
            />
          )}
        </View>
      )}
    </View>
  );
};
