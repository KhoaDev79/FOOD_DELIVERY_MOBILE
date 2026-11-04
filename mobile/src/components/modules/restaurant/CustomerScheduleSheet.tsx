import React from 'react';
import { View } from 'react-native';
import { RestaurantOpeningHour, RestaurantSpecialClosing } from '../../../types/api';
import { DAY_OF_WEEK_NAMES, vnDayOfWeek } from '../../../utils/openingHours';
import { BottomSheet, Icon, Text } from '../../ui';

export interface CustomerScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  restaurant?: {
    name: string;
    openTime?: string;
    closeTime?: string;
    openingHours?: RestaurantOpeningHour[];
    specialClosings?: RestaurantSpecialClosing[];
  };
  restaurantName?: string;
  defaultOpenTime?: string;
  defaultCloseTime?: string;
  openingHours?: RestaurantOpeningHour[];
  specialClosings?: RestaurantSpecialClosing[];
}

export const CustomerScheduleSheet: React.FC<CustomerScheduleSheetProps> = ({
  visible,
  onClose,
  restaurant,
  restaurantName = restaurant?.name ?? 'Quán',
  defaultOpenTime = restaurant?.openTime ?? '07:00',
  defaultCloseTime = restaurant?.closeTime ?? '22:00',
  openingHours = restaurant?.openingHours,
  specialClosings = restaurant?.specialClosings,
}) => {
  const currentDay = vnDayOfWeek();
  // Thứ tự 7 ngày từ Thứ Hai (1) đến Chủ Nhật (0)
  const daysOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Lịch mở cửa & Ngày nghỉ">
      <View className="px-4 pb-8 gap-4">
        <Text variant="caption" tone="secondary">
          Thời gian phục vụ của <Text variant="caption" weight="bold">{restaurantName}</Text> theo giờ địa phương:
        </Text>

        {/* Bảng 7 ngày */}
        <View className="rounded-2xl border border-line bg-canvas-subtle p-3 gap-2">
          {daysOrder.map((dayOfWeek) => {
            const isToday = dayOfWeek === currentDay;
            const hour = openingHours?.find((h) => h.dayOfWeek === dayOfWeek);
            const isClosed = hour ? hour.isClosed : false;
            const openTime = hour ? hour.openTime : defaultOpenTime;
            const closeTime = hour ? hour.closeTime : defaultCloseTime;
            const isOvernight = !isClosed && closeTime < openTime;

            return (
              <View
                key={dayOfWeek}
                className={`flex-row items-center justify-between rounded-xl px-3 py-2 ${
                  isToday ? 'bg-brand-50 border border-brand-500/30' : 'bg-surface'
                }`}
              >
                <View className="flex-row items-center gap-2">
                  <Text variant="body" weight={isToday ? 'bold' : 'medium'} tone={isToday ? 'brand' : 'default'}>
                    {DAY_OF_WEEK_NAMES[dayOfWeek]}
                  </Text>
                  {isToday && (
                    <View className="rounded-full bg-brand-500 px-2 py-0.5">
                      <Text variant="micro" weight="bold" tone="inverse">
                        Hôm nay
                      </Text>
                    </View>
                  )}
                </View>

                {isClosed ? (
                  <Text variant="caption" weight="bold" tone="danger">
                    Nghỉ bán
                  </Text>
                ) : (
                  <View className="items-end">
                    <Text variant="body" weight={isToday ? 'bold' : 'regular'}>
                      {openTime} - {closeTime}
                    </Text>
                    {isOvernight && (
                      <Text variant="micro" tone="muted">
                        Qua đêm
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Danh sách ngày nghỉ lễ đặc biệt nếu có */}
        {specialClosings && specialClosings.length > 0 && (
          <View className="mt-2 gap-2">
            <View className="flex-row items-center gap-1.5">
              <Icon name="calendar-outline" size="sm" tone="danger" />
              <Text variant="headline" weight="bold">
                Lịch nghỉ lễ / đặc biệt
              </Text>
            </View>

            <View className="rounded-2xl border border-line bg-canvas-subtle p-3 gap-2">
              {specialClosings.map((closing) => {
                const dateStr = closing.date.slice(0, 10);
                return (
                  <View key={closing.id} className="flex-row items-center justify-between bg-surface rounded-xl p-2.5">
                    <Text variant="body" weight="bold">
                      {dateStr}
                    </Text>
                    <Text variant="caption" tone="danger" weight="medium">
                      {closing.reason || 'Nghỉ đóng cửa'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};
