import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { OrderStatusHistory } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { ORDER_STATUS_CONFIG, ORDER_STEPS } from '../../utils/orderStatus';
import { palette } from '../../theme';
import { Icon } from '../ui/Icon';

interface OrderTimelineProps {
  currentStatus: string;
  statusHistory: OrderStatusHistory[];
  reasonText?: string | null;
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ currentStatus, statusHistory, reasonText }) => {
  if (currentStatus === 'CANCELLED' || currentStatus === 'DELIVERY_FAILED') {
    const title = currentStatus === 'DELIVERY_FAILED' ? 'Giao hàng không thành công' : 'Đơn hàng đã bị huỷ';
    return (
      <View style={styles.cancelledBox}>
        <Icon name="close-circle" size={32} tone="danger" />
        <View style={{ flex: 1 }}>
          <Text style={styles.cancelledText}>{title}</Text>
          {!!reasonText && <Text style={styles.timeText}>{reasonText}</Text>}
        </View>
      </View>
    );
  }

  const currentStep = ORDER_STATUS_CONFIG[currentStatus as keyof typeof ORDER_STATUS_CONFIG]?.step ?? 0;

  return (
    <View style={styles.container}>
      {ORDER_STEPS.map((step, index) => {
        const isCompleted = index <= currentStep;
        const isCurrent = index === currentStep;
        const historyItem = statusHistory.find((h) => h.status === step.key);

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                {isCompleted ? (
                  <Icon name="checkmark" size={14} tone="inverse" />
                ) : (
                  <View style={styles.circleInner} />
                )}
              </View>
              {index < ORDER_STEPS.length - 1 && (
                <View
                  style={[
                    styles.line,
                    index < currentStep && styles.lineCompleted,
                  ]}
                />
              )}
            </View>

            <View style={styles.contentCol}>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelCompleted,
                  isCurrent && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
              {historyItem && (
                <Text style={styles.timeText}>{formatDateTime(historyItem.createdAt)}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleCompleted: {
    backgroundColor: colors.success,
  },
  circleCurrent: {
    backgroundColor: colors.primary,
  },
  circleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 2,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
  },
  labelCompleted: {
    color: colors.text,
    fontWeight: '500',
  },
  labelCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.danger.soft,
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  cancelledText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
});

