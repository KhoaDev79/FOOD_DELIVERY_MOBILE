import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../api/orders';
import { Button, Text, TopBar, useToast } from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useOrderDetail } from '../../services/useOrders';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

const RESTAURANT_TAGS = [
  'Món ăn ngon',
  'Món còn nóng hổi',
  'Đúng món đã đặt',
  'Đóng gói cẩn thận',
];

const DRIVER_TAGS = [
  'Giao hàng nhanh',
  'Tài xế lịch sự, thân thiện',
  'Bảo quản món tốt',
];

export const RatingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId, restaurantName, hasDriver: paramHasDriver } = route.params;
  const { data: order } = useOrderDetail(orderId);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [driverStars, setDriverStars] = useState(5);
  const [driverComment, setDriverComment] = useState('');

  const hasDriver = Boolean(order?.driverId ?? order?.driver?.id ?? paramHasDriver);
  const displayRestName = order?.restaurant?.name || restaurantName;
  const displayDriverName = order?.driver?.fullName || 'Tài xế giao hàng';

  const appendSuggestion = (current: string, tag: string, setter: (v: string) => void) => {
    const trimmed = current.trim();
    if (trimmed.includes(tag)) return;
    setter(trimmed ? `${trimmed}. ${tag}` : tag);
  };

  const reviewMutation = useMutation({
    mutationFn: () =>
      ordersApi.review(orderId, {
        rating: stars,
        comment: comment.trim() || undefined,
        ...(hasDriver
          ? {
              driverRating: driverStars,
              driverComment: driverComment.trim() || undefined,
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast('Cảm ơn bạn! Đánh giá đơn hàng đã được ghi nhận.', 'success');
      navigation.goBack();
    },
    onError: (err: any) => {
      toast(err.response?.data?.message || 'Không gửi được đánh giá, vui lòng thử lại.', 'error');
    },
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      <TopBar title="Đánh giá đơn hàng" onLeadingPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView
          style={{ flex: 1 }}
          className="flex-1"
          contentContainerClassName="px-4 py-5 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* PHẦN 1: ĐÁNH GIÁ QUÁN */}
          <View className="gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <View className="items-center py-1">
              <View className="mb-2.5 h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-raised">
                <Ionicons name="storefront" size={28} color="#FFFFFF" />
              </View>
              <Text variant="headline" weight="bold" className="text-center">
                {displayRestName ? `Đánh giá quán ${displayRestName}` : 'Đánh giá nhà hàng'}
              </Text>
              <Text variant="caption" tone="secondary" className="mt-0.5 text-center">
                Chất lượng món ăn và quy cách đóng gói
              </Text>
            </View>

            <View className="flex-row justify-center gap-3 py-1">
              {[1, 2, 3, 4, 5].map((index) => {
                const isFilled = index <= stars;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`Quán ${index} sao`}
                    accessibilityState={{ selected: isFilled }}
                    onPress={() => setStars(index)}
                    className="p-1 active:opacity-70"
                  >
                    <Ionicons
                      name={isFilled ? 'star' : 'star-outline'}
                      size={36}
                      color={isFilled ? '#FFB400' : '#D1D5DB'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View className="gap-2">
              <Text variant="caption" weight="bold" tone="secondary">
                Gợi ý nhận xét nhanh:
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {RESTAURANT_TAGS.map((tag) => (
                  <Pressable
                    key={tag}
                    className="flex-row items-center rounded-full border border-line bg-canvas-subtle px-3 py-1.5 active:bg-brand-50"
                    onPress={() => appendSuggestion(comment, tag, setComment)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={14}
                      color="#1EB9CE"
                      style={{ marginRight: 4 }}
                    />
                    <Text variant="caption" weight="medium">
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput
              placeholder="Nhận xét về món ăn của quán (tối đa 500 ký tự)..."
              placeholderTextColor="#9A9EA5"
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="min-h-[90px] rounded-xl border border-line bg-canvas-subtle p-3 font-body text-body text-ink"
            />
          </View>

          {/* PHẦN 2: ĐÁNH GIÁ TÀI XẾ (Chỉ hiển thị khi đơn có tài xế) */}
          {hasDriver && (
            <View className="gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <View className="items-center py-1">
                <View className="mb-2.5 h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                  <Ionicons name="bicycle" size={28} color="#1EB9CE" />
                </View>
                <Text variant="headline" weight="bold" className="text-center">
                  Đánh giá tài xế {displayDriverName}
                </Text>
                <Text variant="caption" tone="secondary" className="mt-0.5 text-center">
                  Thái độ phục vụ và tốc độ giao hàng
                </Text>
              </View>

              <View className="flex-row justify-center gap-3 py-1">
                {[1, 2, 3, 4, 5].map((index) => {
                  const isFilled = index <= driverStars;
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`Tài xế ${index} sao`}
                      accessibilityState={{ selected: isFilled }}
                      onPress={() => setDriverStars(index)}
                      className="p-1 active:opacity-70"
                    >
                      <Ionicons
                        name={isFilled ? 'star' : 'star-outline'}
                        size={36}
                        color={isFilled ? '#FFB400' : '#D1D5DB'}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-2">
                <Text variant="caption" weight="bold" tone="secondary">
                  Gợi ý nhận xét tài xế:
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DRIVER_TAGS.map((tag) => (
                    <Pressable
                      key={tag}
                      className="flex-row items-center rounded-full border border-line bg-canvas-subtle px-3 py-1.5 active:bg-brand-50"
                      onPress={() => appendSuggestion(driverComment, tag, setDriverComment)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={14}
                        color="#1EB9CE"
                        style={{ marginRight: 4 }}
                      />
                      <Text variant="caption" weight="medium">
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <TextInput
                placeholder="Nhận xét thêm cho tài xế (tối đa 300 ký tự)..."
                placeholderTextColor="#9A9EA5"
                value={driverComment}
                onChangeText={setDriverComment}
                maxLength={300}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="min-h-[75px] rounded-xl border border-line bg-canvas-subtle p-3 font-body text-body text-ink"
              />
            </View>
          )}
        </ScrollView>

        <View className="border-t border-line bg-surface p-4 shadow-card">
          <Button
            label="Gửi đánh giá"
            onPress={() => reviewMutation.mutate()}
            loading={reviewMutation.isPending}
            variant="primary"
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
