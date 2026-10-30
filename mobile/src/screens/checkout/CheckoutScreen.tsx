import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paymentsApi } from '../../api/payments';
import {
  AppImage,
  Badge,
  Button,
  cn,
  EmptyState,
  Icon,
  IconName,
  Input,
  QuantityStepper,
  Skeleton,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { DEFAULT_COORDS } from '../../constants/config';
import { useLocation } from '../../hooks/useLocation';
import { useCreateOrder } from '../../services/useOrders';
import { useAddresses } from '../../services/useUser';
import { CartLineItem, useCartStore } from '../../store/useCartStore';
import { PaymentMethod } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { calculateDeliveryFee, calculateDistance, DELIVERY_FEE_CONFIG, estimateDeliveryTime } from '../../utils/fee';
import { formatDistance, formatVND } from '../../utils/format';
import { linePrice } from '../../utils/menuPricing';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <View className="gap-3 rounded-lg bg-surface p-4 shadow-card">
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
    {children}
  </View>
);

const SummaryRow: React.FC<{ label: string; value: string; hint?: string; strong?: boolean }> = ({
  label,
  value,
  hint,
  strong,
}) => (
  <View className="flex-row items-start justify-between gap-3">
    <View className="flex-1">
      <Text variant={strong ? 'headline' : 'body'} tone={strong ? 'default' : 'secondary'}>
        {label}
      </Text>
      {!!hint && (
        <Text variant="caption" weight="regular" tone="muted">
          {hint}
        </Text>
      )}
    </View>
    <Text variant={strong ? 'title' : 'body'} weight={strong ? 'bold' : 'medium'} tone={strong ? 'brand' : 'default'}>
      {value}
    </Text>
  </View>
);

const PaymentOption: React.FC<{
  icon: IconName;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}> = ({ icon, title, subtitle, selected, onPress }) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={`${title}. ${subtitle}`}
    onPress={onPress}
    className={cn(
      'flex-row items-center gap-3 rounded-md border p-3 active:opacity-80',
      selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
    )}
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
      <Icon name={icon} size="md" tone="brand" />
    </View>
    <View className="flex-1">
      <Text variant="body-lg" weight="medium">
        {title}
      </Text>
      <Text variant="caption" weight="regular" tone="secondary">
        {subtitle}
      </Text>
    </View>
    <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size="md" tone={selected ? 'brand' : 'muted'} />
  </Pressable>
);

const optionSummary = (i: CartLineItem) =>
  [i.size, ...(i.toppings ?? []), i.level ?? i.spiciness].filter(Boolean).join(' · ');

export const CheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const toast = useToast();
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const { coords } = useLocation();
  const { data: addresses, isLoading: addressLoading } = useAddresses();
  const createOrderMutation = useCreateOrder();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Giữ nguyên logic cũ: dùng địa chỉ mặc định, không có thì địa chỉ đầu tiên.
  const activeAddressId = addresses?.find((a) => a.isDefault)?.id || addresses?.[0]?.id || null;
  const activeAddr = addresses?.find((a) => a.id === activeAddressId) || addresses?.[0];
  const userLat = activeAddr?.latitude || coords.latitude;
  const userLng = activeAddr?.longitude || coords.longitude;
  const restLat = restaurant?.latitude || DEFAULT_COORDS.latitude;
  const restLng = restaurant?.longitude || DEFAULT_COORDS.longitude;
  const distanceKm = calculateDistance(restLat, restLng, userLat, userLng);
  // Cùng công thức với backend (utils/fee.ts). Không còn voucher giả: tổng = số tiền backend thu.
  const { fee: deliveryFee, isPeak } = calculateDeliveryFee(distanceKm);
  const grandTotal = subtotal + deliveryFee;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const close = () => navigation.goBack();

  const handlePlaceOrder = async () => {
    if (!restaurant) return;
    if (!activeAddressId) {
      toast('Vui lòng thêm địa chỉ nhận hàng trước khi đặt đơn', 'error');
      navigation.navigate('AddressManagement');
      return;
    }
    try {
      setIsSubmitting(true);
      const order = await createOrderMutation.mutateAsync({
        restaurantId: restaurant.id,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          note: i.note || undefined,
          sizeId: i.sizeId,
          toppingIds: i.toppingIds?.length ? i.toppingIds : undefined,
          level: i.level,
        })),
        addressId: activeAddressId,
        deliveryAddress: activeAddr?.addressLine || 'Địa chỉ giao hàng',
        deliveryLat: activeAddr?.latitude || coords.latitude,
        deliveryLng: activeAddr?.longitude || coords.longitude,
        paymentMethod,
        note: note.trim() || undefined,
      });

      if (paymentMethod === 'VNPAY') {
        try {
          const { paymentUrl } = await paymentsApi.getVnpayUrl(order.id);
          await WebBrowser.openAuthSessionAsync(paymentUrl, 'fooddelivery://payment-result');
        } catch {
          toast('Không thể mở cổng VNPAY, đơn hàng sẽ ở trạng thái chờ thanh toán.', 'error');
        }
      }
      clearCart();
      navigation.replace('OrderTracking', { orderId: order.id });
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Đặt đơn thất bại, vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!restaurant || items.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
        <TopBar title="Xác nhận đơn hàng" onLeadingPress={close} className="bg-canvas-subtle" />
        <EmptyState
          icon="basket-outline"
          title="Giỏ hàng đang trống"
          description="Hãy chọn vài món trước khi thanh toán."
          actionLabel="Khám phá món ngon"
          onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
          className="flex-1"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar title="Xác nhận đơn hàng" onLeadingPress={close} className="bg-canvas-subtle" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="gap-3 px-4 pb-6 pt-1" keyboardShouldPersistTaps="handled">
          {/* Giao đến */}
          <Section
            title="Giao đến"
            action={
              <Button
                label={activeAddr ? 'Đổi' : 'Thêm địa chỉ'}
                variant="ghost"
                size="sm"
                onPress={() => navigation.navigate('AddressManagement')}
              />
            }
          >
            {addressLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : activeAddr ? (
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                  <Icon name="location" size="md" tone="brand" />
                </View>
                <View className="flex-1 gap-1">
                  <Text variant="caption" weight="semibold" tone="brand">
                    {activeAddr.label}
                  </Text>
                  <Text variant="body" numberOfLines={2}>
                    {activeAddr.addressLine}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <View className="flex-row items-center gap-1">
                      <Icon name="navigate-outline" size={12} tone="brand" />
                      <Text variant="caption" weight="regular" tone="secondary">
                        {formatDistance(distanceKm)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Icon name="bicycle-outline" size={12} tone="brand" />
                      <Text variant="caption" weight="regular" tone="secondary">
                        Dự kiến {estimateDeliveryTime(distanceKm)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2 rounded-md bg-warning-soft p-3">
                <Icon name="alert-circle-outline" size="md" tone="accent" />
                <Text variant="body" tone="warning" className="flex-1">
                  Bạn chưa có địa chỉ nhận hàng. Thêm địa chỉ để đặt đơn.
                </Text>
              </View>
            )}
          </Section>

          {/* Món đã chọn */}
          <Section
            title={`Món đã chọn · ${itemCount}`}
            action={
              <Button
                label="Thêm món"
                variant="ghost"
                size="sm"
                leftIcon="add"
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })}
              />
            }
          >
            <View className="flex-row items-center gap-2 border-b border-line-subtle pb-3">
              <AppImage uri={restaurant.imageUrl} className="h-8 w-8 rounded-sm" fallbackIcon="storefront-outline" />
              <Text variant="body" weight="semibold" numberOfLines={1} className="flex-1">
                {restaurant.name}
              </Text>
            </View>
            {items.map((item) => {
              const unit = item.unitPrice ?? linePrice(item.menuItem, item);
              const opts = optionSummary(item);
              return (
                <View key={item.id ?? item.menuItem.id} className="flex-row items-center gap-3">
                  <AppImage
                    uri={item.menuItem.imageUrl}
                    className="h-14 w-14 rounded-md"
                    fallbackIcon="fast-food-outline"
                  />
                  <View className="flex-1 gap-0.5">
                    <Text variant="body" weight="medium" numberOfLines={2}>
                      {item.menuItem.name}
                    </Text>
                    {!!opts && (
                      <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
                        {opts}
                      </Text>
                    )}
                    {!!item.note && (
                      <Text variant="caption" weight="regular" tone="muted" numberOfLines={1}>
                        Ghi chú: {item.note}
                      </Text>
                    )}
                    <Text variant="body" weight="semibold" tone="brand">
                      {formatVND(unit * item.quantity)}
                    </Text>
                  </View>
                  <QuantityStepper
                    value={item.quantity}
                    size="sm"
                    max={50}
                    onChange={(q) => updateQuantity(item.id ?? item.menuItem.id, q)}
                  />
                </View>
              );
            })}
          </Section>

          {/* Ghi chú */}
          <Section title="Ghi chú cho đơn">
            <Input
              placeholder="Ví dụ: giao lên lầu 3, gọi trước khi tới…"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              leftIcon="create-outline"
            />
          </Section>

          {/* Thanh toán */}
          <Section title="Thanh toán">
            <PaymentOption
              icon="cash-outline"
              title="Tiền mặt khi nhận hàng"
              subtitle="Thanh toán cho tài xế khi nhận món"
              selected={paymentMethod === 'COD'}
              onPress={() => setPaymentMethod('COD')}
            />
            <PaymentOption
              icon="card-outline"
              title="VNPAY"
              subtitle="Ví điện tử, thẻ ngân hàng (môi trường thử nghiệm)"
              selected={paymentMethod === 'VNPAY'}
              onPress={() => setPaymentMethod('VNPAY')}
            />
            {/* Voucher tạm ẩn cho đến khi backend áp dụng được mã giảm giá */}
            <View className="flex-row items-center gap-3 rounded-md border border-dashed border-line p-3 opacity-70">
              <Icon name="ticket-outline" size="md" tone="muted" />
              <View className="flex-1">
                <Text variant="body" weight="medium" tone="secondary">
                  Mã giảm giá
                </Text>
                <Text variant="caption" weight="regular" tone="muted">
                  Tính năng đang được phát triển
                </Text>
              </View>
            </View>
          </Section>

          {/* Tóm tắt hoá đơn */}
          <Section title="Chi tiết thanh toán">
            <SummaryRow label={`Tạm tính (${itemCount} món)`} value={formatVND(subtotal)} />
            <SummaryRow
              label="Phí giao hàng"
              value={formatVND(deliveryFee)}
              hint={`${formatDistance(distanceKm)} · ${formatVND(DELIVERY_FEE_CONFIG.baseFee)} cho ${DELIVERY_FEE_CONFIG.freeKm} km đầu, thêm ${formatVND(DELIVERY_FEE_CONFIG.feePerKm)}/km${isPeak ? ` · giờ cao điểm ×${DELIVERY_FEE_CONFIG.peakMultiplier.toLocaleString('vi-VN')}` : ''}`}
            />
            {isPeak && <Badge label="Đang giờ cao điểm" tone="warning" icon="flash" />}
            <View className="border-t border-line-subtle pt-3">
              <SummaryRow label="Tổng cộng" value={formatVND(grandTotal)} strong />
            </View>
            <Text variant="caption" weight="regular" tone="muted">
              Số tiền cuối cùng do hệ thống tính lại khi tạo đơn.
            </Text>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Thanh đặt hàng dính đáy */}
      <SafeAreaView edges={['bottom']} className="border-t border-line-subtle bg-surface shadow-float">
        <View className="flex-row items-center gap-3 px-4 pb-3 pt-3">
          <View className="flex-1">
            <Text variant="caption" weight="regular" tone="secondary">
              Tổng cộng
            </Text>
            <Text variant="title" weight="bold" tone="brand">
              {formatVND(grandTotal)}
            </Text>
          </View>
          <Button
            label="Đặt hàng"
            rightIcon="arrow-forward"
            loading={isSubmitting}
            disabled={!activeAddr || addressLoading}
            onPress={handlePlaceOrder}
            className="flex-1"
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
