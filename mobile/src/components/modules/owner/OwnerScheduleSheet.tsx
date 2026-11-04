import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  useAddSpecialClosing,
  useRemoveSpecialClosing,
  useRestaurantSchedule,
  useUpdateWeeklySchedule,
} from '../../../services/useRestaurants';
import {
  DAY_OF_WEEK_NAMES,
} from '../../../utils/openingHours';
import {
  BottomSheet,
  Button,
  Icon,
  LoadingSpinner,
  Text,
  useToast,
} from '../../ui';

interface DayScheduleDraft {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface OwnerScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
}

export const OwnerScheduleSheet: React.FC<OwnerScheduleSheetProps> = ({
  visible,
  onClose,
  restaurantId,
}) => {
  const toast = useToast();
  const { data, isLoading } = useRestaurantSchedule(restaurantId);
  const updateWeeklyMutation = useUpdateWeeklySchedule();
  const addClosingMutation = useAddSpecialClosing();
  const removeClosingMutation = useRemoveSpecialClosing();

  const [activeTab, setActiveTab] = useState<'weekly' | 'holidays'>('weekly');

  // Form ngày nghỉ đặc biệt
  const [newClosingDate, setNewClosingDate] = useState('');
  const [newClosingReason, setNewClosingReason] = useState('');

  // Lịch 7 ngày lấy từ server; chỉ lưu riêng phần chủ quán đã chỉnh (null = chưa chỉnh)
  // để không phải gán state trong useEffect mỗi khi dữ liệu về.
  const serverDraft = useMemo<DayScheduleDraft[]>(() => {
    if (!data) return [];
    const defaultOpen = data.defaultOpenTime || '07:00';
    const defaultClose = data.defaultCloseTime || '22:00';

    // 7 ngày từ 1 (Thứ hai) đến 6 (Thứ bảy), và 0 (Chủ nhật)
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];
    const initialDraft = daysOrder.map((dayOfWeek) => {
      const existing = data.openingHours.find((h) => h.dayOfWeek === dayOfWeek);
      if (existing) {
        return {
          dayOfWeek,
          openTime: existing.openTime,
          closeTime: existing.closeTime,
          isClosed: existing.isClosed,
        };
      }
      return {
        dayOfWeek,
        openTime: defaultOpen,
        closeTime: defaultClose,
        isClosed: false,
      };
    });

    return initialDraft;
  }, [data]);
  const [edits, setEdits] = useState<DayScheduleDraft[] | null>(null);
  const weeklyDraft = edits ?? serverDraft;
  const setWeeklyDraft = (update: (prev: DayScheduleDraft[]) => DayScheduleDraft[]) =>
    setEdits((prev) => update(prev ?? serverDraft));

  const handleToggleDay = (dayOfWeek: number, isClosed: boolean) => {
    setWeeklyDraft((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, isClosed } : d)),
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: 'openTime' | 'closeTime',
    val: string,
  ) => {
    setWeeklyDraft((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: val } : d)),
    );
  };

  const handleApplyToAll = (templateDay: DayScheduleDraft) => {
    setWeeklyDraft((prev) =>
      prev.map((d) => ({
        ...d,
        openTime: templateDay.openTime,
        closeTime: templateDay.closeTime,
        isClosed: templateDay.isClosed,
      })),
    );
    toast(`Đã sao chép khung giờ ${DAY_OF_WEEK_NAMES[templateDay.dayOfWeek]} cho cả tuần`, 'success');
  };

  const handleSaveWeekly = () => {
    updateWeeklyMutation.mutate(
      {
        restaurantId,
        data: {
          schedule: weeklyDraft,
        },
      },
      {
        onSuccess: () => {
          toast('Đã lưu lịch mở cửa 7 ngày', 'success');
        },
        onError: () => {
          toast('Không thể lưu lịch mở cửa. Vui lòng kiểm tra lại.', 'error');
        },
      },
    );
  };

  const handleAddClosing = () => {
    const trimmedDate = newClosingDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      toast('Vui lòng nhập ngày theo định dạng YYYY-MM-DD (ví dụ: 2026-12-25)', 'error');
      return;
    }

    addClosingMutation.mutate(
      {
        restaurantId,
        data: {
          date: trimmedDate,
          reason: newClosingReason.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setNewClosingDate('');
          setNewClosingReason('');
          toast('Đã thêm ngày nghỉ đặc biệt', 'success');
        },
        onError: () => {
          toast('Không thể thêm ngày nghỉ. Vui lòng thử lại.', 'error');
        },
      },
    );
  };

  const handleRemoveClosing = (closingId: string, dateLabel: string) => {
    Alert.alert(
      'Xoá ngày nghỉ',
      `Bạn có chắc muốn mở lại bán vào ngày ${dateLabel}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            removeClosingMutation.mutate(
              { restaurantId, closingId },
              {
                onSuccess: () => toast('Đã xoá ngày nghỉ', 'success'),
                onError: () => toast('Lỗi khi xoá ngày nghỉ', 'error'),
              },
            );
          },
        },
      ],
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Giờ mở cửa & Ngày nghỉ">
      {isLoading ? (
        <LoadingSpinner message="Đang tải lịch quán..." />
      ) : (
        <ScrollView className="max-h-[80vh] px-4" showsVerticalScrollIndicator={false}>
          {/* Thanh chuyển tab: Lịch 7 ngày vs Ngày nghỉ */}
          <View className="mb-4 flex-row rounded-xl border border-line bg-canvas-subtle p-1">
            <Pressable
              onPress={() => setActiveTab('weekly')}
              className={`flex-1 rounded-lg py-2 items-center active:opacity-80 ${
                activeTab === 'weekly' ? 'bg-surface shadow-card' : 'shadow-none'
              }`}
            >
              <Text variant="caption" weight="bold" tone={activeTab === 'weekly' ? 'brand' : 'secondary'}>
                Lịch 7 ngày trong tuần
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('holidays')}
              className={`flex-1 rounded-lg py-2 items-center active:opacity-80 ${
                activeTab === 'holidays' ? 'bg-surface shadow-card' : 'shadow-none'
              }`}
            >
              <Text variant="caption" weight="bold" tone={activeTab === 'holidays' ? 'brand' : 'secondary'}>
                Ngày nghỉ đặc biệt ({data?.specialClosings.length || 0})
              </Text>
            </Pressable>
          </View>

          {activeTab === 'weekly' ? (
            // ==================== TAB 1: LỊCH 7 NGÀY ====================
            <View className="gap-3 pb-8">
              <Text variant="caption" tone="secondary">
                Cài đặt khung giờ nhận đơn chi tiết cho từng ngày trong tuần. Khách chỉ có thể đặt đơn trong khung giờ này.
              </Text>

              {weeklyDraft.map((item, idx) => {
                const dayName = DAY_OF_WEEK_NAMES[item.dayOfWeek];
                const isOvernight = item.closeTime < item.openTime;

                return (
                  <View
                    key={item.dayOfWeek}
                    className={`rounded-2xl border p-3.5 ${
                      item.isClosed
                        ? 'border-line/60 bg-canvas-subtle opacity-70'
                        : 'border-line bg-surface'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text variant="body" weight="bold">
                          {dayName}
                        </Text>
                        {item.isClosed ? (
                          <View className="rounded-full bg-danger-soft px-2 py-0.5">
                            <Text variant="micro" tone="danger" weight="bold">
                              Nghỉ bán
                            </Text>
                          </View>
                        ) : (
                          <View className="rounded-full bg-success-soft px-2 py-0.5">
                            <Text variant="micro" tone="success" weight="bold">
                              Mở cửa
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center gap-3">
                        {!item.isClosed && idx === 0 && (
                          <Pressable
                            onPress={() => handleApplyToAll(item)}
                            className="rounded-full bg-brand-50 px-2.5 py-1 active:opacity-70"
                          >
                            <Text variant="micro" weight="bold" tone="brand">
                              Áp dụng cả tuần
                            </Text>
                          </Pressable>
                        )}
                        <Switch
                          value={!item.isClosed}
                          onValueChange={(val) => handleToggleDay(item.dayOfWeek, !val)}
                          trackColor={{ false: '#E2E8F0', true: '#00A896' }}
                        />
                      </View>
                    </View>

                    {!item.isClosed && (
                      <View className="mt-3 flex-row items-center gap-2 pt-2 border-t border-line/40">
                        <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-line bg-canvas-subtle px-3 py-1.5">
                          <Text variant="caption" tone="secondary">
                            Từ:
                          </Text>
                          <TextInput
                            className="flex-1 font-body text-body text-ink p-0"
                            value={item.openTime}
                            placeholder="07:00"
                            maxLength={5}
                            onChangeText={(v) => handleTimeChange(item.dayOfWeek, 'openTime', v)}
                          />
                        </View>

                        <Text variant="body" tone="secondary">
                          -
                        </Text>

                        <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-line bg-canvas-subtle px-3 py-1.5">
                          <Text variant="caption" tone="secondary">
                            Đến:
                          </Text>
                          <TextInput
                            className="flex-1 font-body text-body text-ink p-0"
                            value={item.closeTime}
                            placeholder="22:00"
                            maxLength={5}
                            onChangeText={(v) => handleTimeChange(item.dayOfWeek, 'closeTime', v)}
                          />
                        </View>
                      </View>
                    )}

                    {!item.isClosed && isOvernight && (
                      <Text variant="micro" tone="muted" className="mt-1.5">
                        * Mở qua đêm, đóng cửa lúc {item.closeTime} sáng hôm sau.
                      </Text>
                    )}
                  </View>
                );
              })}

              <Button
                label="Lưu lịch mở cửa"
                onPress={handleSaveWeekly}
                loading={updateWeeklyMutation.isPending}
                className="mt-2"
              />
            </View>
          ) : (
            // ==================== TAB 2: NGÀY NGHỈ ĐẶC BIỆT ====================
            <View className="gap-4 pb-8">
              <Text variant="caption" tone="secondary">
                Đặt lịch nghỉ trước cho các dịp lễ, Tết, đám cưới hoặc sửa chữa quán. Quán sẽ tự động đóng cửa trong những ngày này.
              </Text>

              {/* Form thêm ngày nghỉ */}
              <View className="rounded-2xl border border-line bg-canvas-subtle p-3.5 gap-2.5">
                <Text variant="body" weight="bold">
                  Thêm ngày nghỉ mới
                </Text>

                <View className="rounded-xl border border-line bg-surface px-3 py-2">
                  <Text variant="micro" tone="secondary">
                    Ngày nghỉ (Định dạng YYYY-MM-DD)
                  </Text>
                  <TextInput
                    className="font-body text-body text-ink p-0 mt-0.5"
                    placeholder="Ví dụ: 2026-12-25"
                    value={newClosingDate}
                    onChangeText={setNewClosingDate}
                    maxLength={10}
                  />
                </View>

                <View className="rounded-xl border border-line bg-surface px-3 py-2">
                  <Text variant="micro" tone="secondary">
                    Lý do nghỉ (Tùy chọn)
                  </Text>
                  <TextInput
                    className="font-body text-body text-ink p-0 mt-0.5"
                    placeholder="Ví dụ: Nghỉ Tết Nguyên Đán, Giáng Sinh..."
                    value={newClosingReason}
                    onChangeText={setNewClosingReason}
                    maxLength={100}
                  />
                </View>

                <Button
                  label="Thêm ngày nghỉ"
                  size="sm"
                  onPress={handleAddClosing}
                  loading={addClosingMutation.isPending}
                />
              </View>

              {/* Danh sách ngày nghỉ đã đặt */}
              <Text variant="title" weight="bold" className="mt-2">
                Các ngày nghỉ đã lên lịch
              </Text>

              {data?.specialClosings.length === 0 ? (
                <Text variant="caption" tone="secondary" className="py-2 text-center">
                  Chưa có ngày nghỉ đặc biệt nào được thiết lập.
                </Text>
              ) : (
                data?.specialClosings.map((closing) => {
                  const dateStr = closing.date.slice(0, 10);
                  return (
                    <View
                      key={closing.id}
                      className="flex-row items-center justify-between rounded-xl border border-line bg-surface p-3"
                    >
                      <View className="flex-1 gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <Icon name="calendar-outline" size="sm" tone="danger" />
                          <Text variant="body" weight="bold">
                            {dateStr}
                          </Text>
                        </View>
                        {closing.reason && (
                          <Text variant="caption" tone="secondary">
                            {closing.reason}
                          </Text>
                        )}
                      </View>

                      <Pressable
                        onPress={() => handleRemoveClosing(closing.id, dateStr)}
                        hitSlop={8}
                        className="p-1 active:opacity-60"
                      >
                        <Icon name="trash-outline" size="sm" tone="danger" />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
};
