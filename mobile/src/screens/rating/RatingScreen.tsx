import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../api/orders';
import { orderCode } from '../../components/modules/partner/PartnerKit';
import { AppImage, Button, cn, Icon, IconName, Text, TopBar, useToast } from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useOrderDetail } from '../../services/useOrders';
import { palette } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

/** Nhãn theo số sao (kiểu GrabFood/ShopeeFood). */
const STAR_LABEL: Record<number, { text: string; emoji: string }> = {
  1: { text: 'Rất tệ', emoji: '😞' },
  2: { text: 'Chưa hài lòng', emoji: '😕' },
  3: { text: 'Bình thường', emoji: '😐' },
  4: { text: 'Hài lòng', emoji: '🙂' },
  5: { text: 'Tuyệt vời!', emoji: '😍' },
};

/** Gợi ý đổi theo mức hài lòng: khen khi 4–5 sao, góp ý khi 1–3 sao. */
const RESTAURANT_TAGS = {
  good: ['Món ăn ngon', 'Món còn nóng hổi', 'Đúng món đã đặt', 'Đóng gói cẩn thận', 'Phần ăn đầy đặn'],
  bad: ['Món bị nguội', 'Thiếu hoặc sai món', 'Đóng gói chưa kỹ', 'Chưa đúng khẩu vị', 'Phần ăn ít'],
};
const DRIVER_TAGS = {
  good: ['Giao hàng nhanh', 'Lịch sự, thân thiện', 'Bảo quản món tốt', 'Liên lạc rõ ràng'],
  bad: ['Giao chậm', 'Thái độ chưa tốt', 'Làm đổ, hỏng món', 'Khó liên lạc'],
};

/** Ghép các thẻ đã chọn với phần khách tự viết, giữ trong giới hạn ký tự của backend. */
const buildComment = (tags: string[], text: string, max: number) =>
  [...tags, text.trim()].filter(Boolean).join('. ').slice(0, max) || undefined;

export const RatingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId, restaurantName, hasDriver: paramHasDriver } = route.params;
  const { data: order } = useOrderDetail(orderId);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [driverStars, setDriverStars] = useState(5);
  const [driverTags, setDriverTags] = useState<string[]>([]);
  const [driverComment, setDriverComment] = useState('');

  const hasDriver = Boolean(order?.driverId ?? order?.driver?.id ?? paramHasDriver);
  const displayRestName = order?.restaurant?.name || restaurantName || 'Nhà hàng';
  const displayDriverName = order?.driver?.fullName || 'Tài xế giao hàng';
  const itemCount = order?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  // Đổi mức hài lòng (khen ↔ góp ý) thì bỏ các thẻ không còn phù hợp
  const changeStars = (value: number, setValue: (v: number) => void, setSelected: (fn: (t: string[]) => string[]) => void, pool: typeof RESTAURANT_TAGS) => {
    setValue(value);
    const list = value >= 4 ? pool.good : pool.bad;
    setSelected((cur) => cur.filter((t) => list.includes(t)));
  };

  const reviewMutation = useMutation({
    mutationFn: () =>
      ordersApi.review(orderId, {
        rating: stars,
        comment: buildComment(tags, comment, 500),
        ...(hasDriver
          ? {
              driverRating: driverStars,
              driverComment: buildComment(driverTags, driverComment, 300),
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
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar title="Đánh giá đơn hàng" onLeadingPress={() => navigation.goBack()} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerClassName="gap-3 px-4 py-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tóm tắt đơn đang đánh giá */}
          <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
            <AppImage uri={order?.restaurant?.imageUrl} className="h-12 w-12 rounded-xl" fallbackIcon="storefront-outline" />
            <View className="flex-1">
              <Text variant="body" weight="bold" numberOfLines={1}>
                {displayRestName}
              </Text>
              <Text variant="caption" weight="regular" tone="muted">
                Đơn #{orderCode(orderId)}
                {itemCount ? ` · ${itemCount} món` : ''}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-success-soft px-2.5 py-1">
              <Icon name="checkmark-circle" size={13} tone="success" />
              <Text variant="micro" weight="bold" tone="success">
                Đã giao
              </Text>
            </View>
          </View>

          <RatingSection
            icon="storefront"
            iconBox="bg-brand-500"
            iconTone="inverse"
            title="Món ăn của quán thế nào?"
            subtitle="Chất lượng món ăn và quy cách đóng gói"
            stars={stars}
            onStars={(v) => changeStars(v, setStars, setTags, RESTAURANT_TAGS)}
            tagPool={stars >= 4 ? RESTAURANT_TAGS.good : RESTAURANT_TAGS.bad}
            selectedTags={tags}
            onToggleTag={(t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
            comment={comment}
            onComment={setComment}
            placeholder="Chia sẻ thêm về món ăn (không bắt buộc)"
            maxLength={500}
          />

          {hasDriver && (
            <RatingSection
              icon="bicycle"
              iconBox="bg-brand-50"
              iconTone="brand"
              avatarText={displayDriverName.charAt(0).toUpperCase()}
              title={`Tài xế ${displayDriverName}`}
              subtitle="Thái độ phục vụ và tốc độ giao hàng"
              stars={driverStars}
              onStars={(v) => changeStars(v, setDriverStars, setDriverTags, DRIVER_TAGS)}
              tagPool={driverStars >= 4 ? DRIVER_TAGS.good : DRIVER_TAGS.bad}
              selectedTags={driverTags}
              onToggleTag={(t) =>
                setDriverTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
              }
              comment={driverComment}
              onComment={setDriverComment}
              placeholder="Nhắn gửi tài xế (không bắt buộc)"
              maxLength={300}
            />
          )}
        </ScrollView>

        <View className="border-t border-line-subtle bg-surface px-4 pb-2 pt-3">
          <Button
            label="Gửi đánh giá"
            leftIcon="send"
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

const RatingSection: React.FC<{
  icon: IconName;
  iconBox: string;
  iconTone: 'inverse' | 'brand';
  avatarText?: string;
  title: string;
  subtitle: string;
  stars: number;
  onStars: (v: number) => void;
  tagPool: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  comment: string;
  onComment: (v: string) => void;
  placeholder: string;
  maxLength: number;
}> = ({
  icon,
  iconBox,
  iconTone,
  avatarText,
  title,
  subtitle,
  stars,
  onStars,
  tagPool,
  selectedTags,
  onToggleTag,
  comment,
  onComment,
  placeholder,
  maxLength,
}) => {
  const label = STAR_LABEL[stars];
  return (
    <View className="gap-4 rounded-2xl bg-surface p-4 shadow-card">
      <View className="flex-row items-center gap-3">
        <View className={cn('h-11 w-11 items-center justify-center rounded-full', iconBox)}>
          {avatarText ? (
            <Text variant="headline" weight="bold" tone="brand">
              {avatarText}
            </Text>
          ) : (
            <Icon name={icon} size="md" tone={iconTone} />
          )}
        </View>
        <View className="flex-1">
          <Text variant="body-lg" weight="bold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" weight="regular" tone="muted">
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Sao + nhãn cảm xúc */}
      <View className="items-center gap-1.5 rounded-2xl bg-canvas-subtle py-3">
        <View className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((i) => {
            const filled = i <= stars;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${i} sao`}
                accessibilityState={{ selected: filled }}
                onPress={() => onStars(i)}
                hitSlop={4}
                className="active:scale-90"
              >
                <Icon name={filled ? 'star' : 'star-outline'} size={38} color={filled ? palette.rating : palette.line.DEFAULT} />
              </Pressable>
            );
          })}
        </View>
        <Text variant="body" weight="bold" className={stars >= 4 ? 'text-warning-strong' : 'text-ink-secondary'}>
          {label.emoji} {label.text}
        </Text>
      </View>

      {/* Thẻ gợi ý: bấm để chọn / bỏ chọn */}
      <View className="gap-2">
        <Text variant="caption" weight="semibold" tone="secondary">
          {stars >= 4 ? 'Bạn thích điều gì?' : 'Điều gì chưa ổn?'}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {tagPool.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => onToggleTag(tag)}
                className={cn(
                  'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-80',
                  selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                )}
              >
                {selected && <Icon name="checkmark" size={14} tone="brand" />}
                <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'default'}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Nhận xét thêm */}
      <View className="gap-1">
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={palette.ink.muted}
          value={comment}
          onChangeText={onComment}
          maxLength={maxLength}
          multiline
          textAlignVertical="top"
          className="min-h-[88px] rounded-xl bg-canvas-subtle p-3 font-body text-body text-ink"
        />
        <Text variant="micro" weight="regular" tone="muted" className="text-right">
          {comment.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
};
