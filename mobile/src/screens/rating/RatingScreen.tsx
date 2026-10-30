import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { Button, Text, TopBar, useToast } from '../../components/ui';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

const FEEDBACK_TAGS = [
  'Món ăn ngon',
  'Món còn nóng hổi',
  'Đúng món đã đặt',
  'Đóng gói cẩn thận',
  'Giao nhanh',
  'Tài xế thân thiện',
];

export const RatingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId, restaurantName } = route.params;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  // Gửi đánh giá thật lên server (trước đây chỉ giả lập, điểm của quán không bao giờ đổi)
  const reviewMutation = useMutation({
    mutationFn: () =>
      ordersApi.review(orderId, {
        rating: stars,
        comment: [selectedTags.join(', '), comment.trim()].filter(Boolean).join('. ') || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast('Cảm ơn bạn! Đánh giá đã được ghi nhận.', 'success');
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
    },
    onError: (err: any) => {
      toast(err.response?.data?.message || 'Không gửi được đánh giá, vui lòng thử lại.', 'error');
    },
  });

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleSubmit = () => reviewMutation.mutate();

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
          contentContainerClassName="px-4 py-5 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar & Title */}
          <View className="items-center py-2">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-500 shadow-raised mb-3">
              <Ionicons name="storefront" size={40} color="#FFFFFF" />
            </View>
            <Text variant="title" weight="bold" className="text-center">
              {restaurantName ? `Bạn thấy ${restaurantName} thế nào?` : 'Bạn thấy đơn hàng thế nào?'}
            </Text>
            <Text variant="body" tone="secondary" className="mt-1 text-center">
              Số sao được tính vào điểm đánh giá của quán
            </Text>
          </View>

          {/* 5 Stars Rating Bar */}
          <View className="flex-row justify-center gap-3 py-2">
            {[1, 2, 3, 4, 5].map((index) => {
              const isFilled = index <= stars;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`${index} sao`}
                  accessibilityState={{ selected: isFilled }}
                  onPress={() => setStars(index)}
                  className="p-1 active:opacity-70"
                >
                  <Ionicons
                    name={isFilled ? 'star' : 'star-outline'}
                    size={40}
                    color={isFilled ? '#FFB400' : '#D1D5DB'}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Quick Feedback Tags */}
          <View className="gap-2.5">
            <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
              Chọn điểm bạn hài lòng:
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FEEDBACK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    className={`flex-row items-center rounded-full border px-3.5 py-2 active:opacity-70 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-line bg-canvas-subtle'
                    }`}
                    onPress={() => toggleTag(tag)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={16}
                      color={isSelected ? '#1EB9CE' : '#6B6F76'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      variant="caption"
                      weight="medium"
                      className={isSelected ? 'text-brand-600' : 'text-ink-secondary'}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Comment Area */}
          <View className="gap-2">
            <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
              Để lại lời nhắn (không bắt buộc):
            </Text>
            <TextInput
              placeholder="Chia sẻ thêm về món ăn, quán hoặc tài xế..."
              placeholderTextColor="#9A9EA5"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[110px] rounded-xl border border-line bg-canvas-subtle p-3.5 font-body text-body text-ink"
            />
          </View>
        </ScrollView>

        {/* Nút gửi đánh giá */}
        <View className="border-t border-line bg-surface p-4 shadow-card">
          <Button
            label="Gửi đánh giá"
            onPress={handleSubmit}
            loading={reviewMutation.isPending}
            variant="primary"
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
