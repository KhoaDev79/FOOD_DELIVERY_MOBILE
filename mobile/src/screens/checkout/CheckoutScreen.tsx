import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrderItemPayload, ordersApi } from '../../api/orders';
import {
  AppImage,
  Badge,
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  Icon,
  Input,
  QuantityStepper,
  Skeleton,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { useCreateOrder } from '../../services/useOrders';
import { useAddresses } from '../../services/useUser';
import { CartLineItem, useCartStore } from '../../store/useCartStore';
import { useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
import { OrderQuoteResponse } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatDistance, formatVND } from '../../utils/format';
import { linePrice } from '../../utils/menuPricing';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

const optionSummary = (i: CartLineItem) =>
  [i.size, ...(i.toppings ?? []), i.level ?? i.spiciness].filter(Boolean).join(' · ');

export const CheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const toast = useToast();
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const { data: addresses, isLoading: addressLoading } = useAddresses();
  const selectedAddressId = useDeliveryAddressStore((s) => s.selectedAddressId);
  const setSelectedAddressId = useDeliveryAddressStore((s) => s.setSelectedAddressId);

  const createOrderMutation = useCreateOrder();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  const [quote, setQuote] = useState<OrderQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [unavailableItemIds, setUnavailableItemIds] = useState<string[]>([]);

  const [quoteChangedDialog, setQuoteChangedDialog] = useState<{
    oldTotal: number;
    newQuote: OrderQuoteResponse;
  } | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const activeAddr = useMemo(() => {
    if (!addresses || addresses.length === 0) return null;
    if (selectedAddressId) {
      const found = addresses.find((a) => a.id === selectedAddressId);
      if (found) return found;
    }
    return addresses.find((a) => a.isDefault) || addresses[0];
  }, [addresses, selectedAddressId]);

  const activeAddressId = activeAddr?.id || null;

  const orderItemsPayload: OrderItemPayload[] = useMemo(
    () =>
      items.map((i) => ({
        menuItemId: i.menuItem.id,
        quantity: i.quantity,
        note: i.note || undefined,
        sizeId: i.sizeId,
        toppingIds: i.toppingIds?.length ? i.toppingIds : undefined,
        level: i.level,
      })),
    [items],
  );

  const fetchQuote = useCallback(
    async (restId: string, addrId: string, payloadItems: OrderItemPayload[]) => {
      setQuoteLoading(true);
      setQuoteError(null);
      setUnavailableItemIds([]);
      idempotencyKeyRef.current = generateIdempotencyKey();
      try {
        const res = await ordersApi.quote({
          restaurantId: restId,
          addressId: addrId,
          items: payloadItems,
        });
        setQuote(res);
      } catch (err: any) {
        const data = err?.response?.data;
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
            ? data.message[0]
            : 'Không thể tính phí giao hàng cho địa chỉ này.';
        setQuote(null);
        setQuoteError(msg);
        if (Array.isArray(data?.unavailableItemIds)) {
          setUnavailableItemIds(data.unavailableItemIds);
        }
      } finally {
        setQuoteLoading(false);
      }
    },
    [],
  );

  // Gọi báo giá mỗi khi quán, địa chỉ hoặc giỏ hàng thay đổi (debounce 400ms)
  useEffect(() => {
    if (!restaurant?.id || !activeAddressId || orderItemsPayload.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      fetchQuote(restaurant.id, activeAddressId, orderItemsPayload);
    }, 400);
    return () => clearTimeout(timer);
  }, [restaurant?.id, activeAddressId, orderItemsPayload, fetchQuote]);

  // Tự động làm mới báo giá trước khi hết hạn 60s
  useEffect(() => {
    if (!quote?.expiresAt || !restaurant?.id || !activeAddressId || orderItemsPayload.length === 0) {
      return;
    }
    const expiresMs = new Date(quote.expiresAt).getTime();
    const refreshInMs = Math.max(5000, expiresMs - Date.now() - 60_000);
    const timer = setTimeout(() => {
      fetchQuote(restaurant.id, activeAddressId, orderItemsPayload);
    }, refreshInMs);
    return () => clearTimeout(timer);
  }, [quote?.expiresAt, restaurant?.id, activeAddressId, orderItemsPayload, fetchQuote]);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const close = () => navigation.goBack();

  const submitOrderWithQuote = async (targetQuote: OrderQuoteResponse) => {
    if (!restaurant || !activeAddressId) return;
    try {
      setIsSubmitting(true);
      const order = await createOrderMutation.mutateAsync({
        payload: {
          restaurantId: restaurant.id,
          items: orderItemsPayload,
          addressId: activeAddressId,
          quoteToken: targetQuote.quoteToken,
          note: note.trim() || undefined,
        },
        idempotencyKey: idempotencyKeyRef.current,
      });

      clearCart();
      navigation.replace('OrderTracking', { orderId: order.id });
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.code === 'QUOTE_CHANGED' && data?.quote) {
        const newQuote = data.quote as OrderQuoteResponse;
        const oldTotal = targetQuote.total;
        setQuote(newQuote);
        idempotencyKeyRef.current = generateIdempotencyKey();
        setQuoteChangedDialog({ oldTotal, newQuote });
        return;
      }
      if (Array.isArray(data?.unavailableItemIds)) {
        setUnavailableItemIds(data.unavailableItemIds);
      }
      toast(data?.message || 'Đặt đơn thất bại, vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceOrder = () => {
    if (!restaurant) return;
    if (!activeAddressId) {
      toast('Vui lòng thêm địa chỉ nhận hàng trước khi đặt đơn', 'error');
      navigation.navigate('AddAddress');
      return;
    }
    if (!quote) {
      toast(quoteError || 'Đang tính phí đơn hàng, vui lòng đợi giây lát.', 'error');
      return;
    }
    submitOrderWithQuote(quote);
  };

  const handleRemoveUnavailableItems = () => {
    const unavailableSet = new Set(unavailableItemIds);
    items.forEach((item) => {
      if (unavailableSet.has(item.menuItem.id)) {
        removeItem(item.id ?? item.menuItem.id);
      }
    });
    setUnavailableItemIds([]);
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

  const displaySubtotal = quote?.subtotal ?? subtotal;
  const displayTotal = quote?.total ?? subtotal;
  const canSubmit =
    Boolean(activeAddr) &&
    !addressLoading &&
    !quoteLoading &&
    Boolean(quote) &&
    !quoteError &&
    unavailableItemIds.length === 0 &&
    !isSubmitting;

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
                onPress={() => {
                  if (addresses && addresses.length > 0) {
                    setAddressSheetVisible(true);
                  } else {
                    navigation.navigate('AddAddress');
                  }
                }}
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
                  {quote && (
                    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                      <View className="flex-row items-center gap-1">
                        <Icon name="navigate-outline" size={12} tone="brand" />
                        <Text variant="caption" weight="regular" tone="secondary">
                          {formatDistance(quote.distanceKm)}
                          {quote.distanceSource === 'ESTIMATED' ? ' (ước tính)' : ''}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Icon name="bicycle-outline" size={12} tone="brand" />
                        <Text variant="caption" weight="regular" tone="secondary">
                          Dự kiến {quote.estimatedMinutes.min}–{quote.estimatedMinutes.max} phút
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => navigation.navigate('AddAddress')}
                className="flex-row items-center gap-2 rounded-md bg-warning-soft p-3"
              >
                <Icon name="alert-circle-outline" size="md" tone="accent" />
                <Text variant="body" tone="warning" className="flex-1">
                  Bạn chưa có địa chỉ nhận hàng. Chạm để thêm địa chỉ mới.
                </Text>
              </Pressable>
            )}
          </Section>

          {/* Cảnh báo lỗi báo giá hoặc món hết hàng */}
          {!!quoteError && (
            <View className="gap-2 rounded-lg border border-danger-soft bg-danger-soft/30 p-3.5">
              <View className="flex-row items-center gap-2">
                <Icon name="alert-circle" size="md" tone="danger" />
                <Text variant="body" weight="semibold" tone="danger" className="flex-1">
                  {quoteError}
                </Text>
              </View>
              {unavailableItemIds.length > 0 && (
                <Button
                  label="Xoá các món hết hàng khỏi giỏ"
                  variant="danger"
                  size="sm"
                  leftIcon="trash-outline"
                  onPress={handleRemoveUnavailableItems}
                />
              )}
            </View>
          )}

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
              const isUnavailable = unavailableItemIds.includes(item.menuItem.id);
              return (
                <View
                  key={item.id ?? item.menuItem.id}
                  className={cn(
                    'flex-row items-center gap-3 rounded-md p-1',
                    isUnavailable && 'bg-danger-soft/20',
                  )}
                >
                  <AppImage
                    uri={item.menuItem.imageUrl}
                    className="h-14 w-14 rounded-md"
                    fallbackIcon="fast-food-outline"
                  />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text variant="body" weight="medium" numberOfLines={2} className="flex-1">
                        {item.menuItem.name}
                      </Text>
                      {isUnavailable && <Badge label="Hết món" tone="danger" size="sm" />}
                    </View>
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

          {/* Phương thức thanh toán cố định COD */}
          <Section title="Phương thức thanh toán">
            <View className="flex-row items-center gap-3 rounded-md border border-brand-500 bg-brand-50 p-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Icon name="cash-outline" size="md" tone="brand" />
              </View>
              <View className="flex-1">
                <Text variant="body-lg" weight="medium">
                  Thanh toán tiền mặt khi nhận hàng
                </Text>
                <Text variant="caption" weight="regular" tone="secondary">
                  Thanh toán trực tiếp cho tài xế khi nhận món (COD)
                </Text>
              </View>
              <Icon name="checkmark-circle" size="md" tone="brand" />
            </View>
          </Section>

          {/* Tóm tắt hoá đơn từ server quote */}
          <Section title="Chi tiết thanh toán">
            {quoteLoading && !quote ? (
              <View className="gap-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-6 w-full" />
              </View>
            ) : quote ? (
              <>
                <SummaryRow label={`Tạm tính (${itemCount} món)`} value={formatVND(quote.subtotal)} />
                <SummaryRow
                  label={`Phí giao hàng (${formatDistance(quote.distanceKm)})`}
                  value={formatVND(quote.baseDeliveryFee)}
                  hint={
                    quote.distanceSource === 'ESTIMATED'
                      ? 'Khoảng cách ước tính'
                      : 'Tính theo quãng đường di chuyển thực tế'
                  }
                />
                {quote.peakSurcharge > 0 && (
                  <SummaryRow
                    label="Phụ phí giờ cao điểm"
                    value={formatVND(quote.peakSurcharge)}
                    hint="Khung giờ cao điểm trưa / tối"
                  />
                )}
                {quote.isPeak && <Badge label="Đang giờ cao điểm" tone="warning" icon="flash" />}
                <View className="border-t border-line-subtle pt-3">
                  <SummaryRow label="Tổng cộng" value={formatVND(quote.total)} strong />
                </View>
              </>
            ) : (
              <>
                <SummaryRow label={`Tạm tính (${itemCount} món)`} value={formatVND(displaySubtotal)} />
                <Text variant="caption" tone="secondary">
                  {activeAddr
                    ? 'Không thể lấy báo giá vận chuyển cho địa chỉ này.'
                    : 'Vui lòng chọn địa chỉ giao hàng để tính phí vận chuyển.'}
                </Text>
              </>
            )}
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
              {quoteLoading && !quote ? 'Đang tính...' : formatVND(displayTotal)}
            </Text>
          </View>
          <Button
            label="Đặt hàng"
            rightIcon="arrow-forward"
            loading={isSubmitting || quoteLoading}
            disabled={!canSubmit}
            onPress={handlePlaceOrder}
            className="flex-1"
          />
        </View>
      </SafeAreaView>

      {/* BottomSheet đổi địa chỉ nhận hàng ngay trên Checkout */}
      <BottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        title="Chọn địa chỉ nhận hàng"
        footer={
          <View className="flex-row gap-3 pb-2">
            <Button
              label="Quản lý sổ địa chỉ"
              variant="outline"
              size="md"
              className="flex-1"
              onPress={() => {
                setAddressSheetVisible(false);
                navigation.navigate('AddressManagement');
              }}
            />
            <Button
              label="Thêm địa chỉ mới"
              variant="primary"
              size="md"
              leftIcon="add"
              className="flex-1"
              onPress={() => {
                setAddressSheetVisible(false);
                navigation.navigate('AddAddress');
              }}
            />
          </View>
        }
      >
        <ScrollView className="max-h-80" contentContainerClassName="gap-2 py-2">
          {(addresses ?? []).map((addr) => {
            const isSelected = addr.id === activeAddressId;
            return (
              <Pressable
                key={addr.id}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  setAddressSheetVisible(false);
                }}
                className={cn(
                  'flex-row items-center gap-3 rounded-lg border p-3',
                  isSelected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                )}
              >
                <Icon
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size="md"
                  tone={isSelected ? 'brand' : 'muted'}
                />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text variant="body" weight="semibold">
                      {addr.label}
                    </Text>
                    {addr.isDefault && <Badge label="Mặc định" tone="brand" size="sm" />}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={2}>
                    {addr.addressLine}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Hộp xác nhận khi báo giá thay đổi (409 QUOTE_CHANGED) */}
      <ConfirmDialog
        visible={Boolean(quoteChangedDialog)}
        title="Giá đơn hàng vừa thay đổi"
        message={
          quoteChangedDialog
            ? `Tổng thanh toán đã cập nhật từ ${formatVND(quoteChangedDialog.oldTotal)} thành ${formatVND(
                quoteChangedDialog.newQuote.total,
              )} (Tạm tính: ${formatVND(quoteChangedDialog.newQuote.subtotal)}, Phí giao: ${formatVND(
                quoteChangedDialog.newQuote.deliveryFee,
              )}). Bạn có muốn tiếp tục đặt đơn với mức giá mới không?`
            : ''
        }
        confirmLabel="Xác nhận giá mới"
        cancelLabel="Xem lại đơn"
        loading={isSubmitting}
        onCancel={() => setQuoteChangedDialog(null)}
        onConfirm={() => {
          const nextQuote = quoteChangedDialog?.newQuote;
          setQuoteChangedDialog(null);
          if (nextQuote) {
            submitOrderWithQuote(nextQuote);
          }
        }}
      />
    </SafeAreaView>
  );
};
