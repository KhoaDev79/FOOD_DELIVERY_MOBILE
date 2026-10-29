import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { paymentsApi } from '../../api/payments';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../constants/config';
import { useLocation } from '../../hooks/useLocation';
import { useCreateOrder } from '../../services/useOrders';
import { useAddresses } from '../../services/useUser';
import { useCartStore } from '../../store/useCartStore';
import { PaymentMethod } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { calculateDeliveryFee, calculateDistance } from '../../utils/fee';
import { formatVND } from '../../utils/format';
import { VoucherItem } from '../voucher/VoucherSelectScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const ALSO_ORDERED = [
  {
    id: 'ao-1',
    name: 'Coca Cola tươi mát lạnh',
    price: 15000,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300',
  },
  {
    id: 'ao-2',
    name: 'Khoai tây chiên lắc phô mai',
    price: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300',
  },
  {
    id: 'ao-3',
    name: 'Trà đào cam sả thanh nhiệt',
    price: 29000,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300',
  },
];

export const CheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const { coords } = useLocation();
  const { data: addresses, isLoading: addressLoading } = useAddresses();
  const createOrderMutation = useCreateOrder();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>({
    id: 'v1',
    code: 'FREESHIP15K',
    title: 'Miễn phí vận chuyển 15.000đ',
    description: 'Áp dụng cho mọi đơn hàng từ 50.000đ',
    discountType: 'shipping',
    discountAmount: 15000,
    minOrder: 50000,
    icon: 'bicycle',
  });
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chọn địa chỉ mặc định đầu tiên nếu có
  React.useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  const activeAddr = addresses?.find((a) => a.id === selectedAddressId) || addresses?.[0];
  const userLat = activeAddr?.latitude || coords.latitude;
  const userLng = activeAddr?.longitude || coords.longitude;
  const restLat = restaurant?.latitude || DEFAULT_COORDS.latitude;
  const restLng = restaurant?.longitude || DEFAULT_COORDS.longitude;

  const distanceKm = calculateDistance(restLat, restLng, userLat, userLng);
  const { fee: deliveryFee, isPeak } = calculateDeliveryFee(distanceKm);

  // Tính giảm giá voucher
  let discountAmount = 0;
  if (selectedVoucher) {
    if (selectedVoucher.discountType === 'shipping') {
      discountAmount = Math.min(deliveryFee, selectedVoucher.discountAmount);
    } else if (selectedVoucher.discountType === 'percentage') {
      discountAmount = Math.min(30000, Math.round((subtotal * selectedVoucher.discountAmount) / 100));
    } else {
      discountAmount = selectedVoucher.discountAmount;
    }
  }

  const grandTotal = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleOpenVoucherSelect = () => {
    navigation.navigate('VoucherSelect', {
      selectedVoucherId: selectedVoucher?.id,
      onSelectVoucher: (v) => setSelectedVoucher(v),
    });
  };

  const handlePlaceOrder = async () => {
    if (!restaurant) return;

    if (!selectedAddressId && (!addresses || addresses.length === 0)) {
      Alert.alert('Chưa có địa chỉ', 'Vui lòng thêm địa chỉ nhận hàng trước khi đặt đơn.');
      navigation.navigate('AddressManagement');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedAddr = addresses?.find((a) => a.id === selectedAddressId);

      const orderPayload = {
        restaurantId: restaurant.id,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          note: [i.size ? `Size: ${i.size}` : '', i.toppings?.length ? `Topping: ${i.toppings.join(', ')}` : '', i.note || '']
            .filter(Boolean)
            .join(' | ') || undefined,
        })),
        addressId: selectedAddressId || undefined,
        deliveryAddress: selectedAddr?.addressLine || 'Địa chỉ giao hàng',
        deliveryLat: selectedAddr?.latitude || coords.latitude,
        deliveryLng: selectedAddr?.longitude || coords.longitude,
        paymentMethod,
        note: note.trim() || undefined,
      };

      const order = await createOrderMutation.mutateAsync(orderPayload);

      // Nếu thanh toán VNPay
      if (paymentMethod === 'VNPAY') {
        try {
          const { paymentUrl } = await paymentsApi.getVnpayUrl(order.id);
          await WebBrowser.openAuthSessionAsync(paymentUrl, 'fooddelivery://payment-result');
        } catch {
          Alert.alert('Thanh toán VNPay', 'Không thể mở cổng thanh toán, đơn hàng sẽ ở trạng thái chờ.');
        }
      }

      clearCart();
      navigation.replace('OrderTracking', { orderId: order.id });
    } catch (err: any) {
      Alert.alert('Đặt đơn thất bại', err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (addressLoading) {
    return <LoadingSpinner message="Đang tải thông tin giao hàng..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Mục 1: Giao đến (Delivered to - Trang 8) */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionHeading}>Giao đến địa chỉ</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddressManagement')}>
              <Text style={styles.editAddressLink}>Đổi địa chỉ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressBox}>
            <View style={styles.pinCircle}>
              <Ionicons name="location-sharp" size={20} color="#EE4D2D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLine} numberOfLines={2}>
                {activeAddr?.addressLine || 'Vui lòng chọn địa chỉ nhận đồ ăn'}
              </Text>
              <View style={styles.deliveryTimeRow}>
                <Ionicons name="time-outline" size={14} color="#EE4D2D" />
                <Text style={styles.deliveryTimeText}>Thời gian giao dự kiến: 20 - 25 phút</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Mục 2: Chi tiết món ăn (Order details - Trang 8) */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionHeading}>Món ăn đã chọn ({items.length})</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.addMoreLink}>+ Thêm món</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, idx) => (
            <View key={item.id || `${item.menuItem.id}-${idx}`} style={styles.orderItemRow}>
              <Image
                source={{
                  uri:
                    item.menuItem.imageUrl ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200',
                }}
                style={styles.itemThumb}
              />
              <View style={styles.itemInfoCol}>
                <Text style={styles.itemName}>{item.menuItem.name}</Text>
                {item.size ? <Text style={styles.itemMeta}>Size: {item.size}</Text> : null}
                {item.toppings?.length ? (
                  <Text style={styles.itemMeta}>Topping: {item.toppings.join(', ')}</Text>
                ) : null}
                {item.spiciness ? <Text style={styles.itemMeta}>Cay: {item.spiciness}</Text> : null}
                <Text style={styles.itemLineTotal}>
                  {formatVND((item.unitPrice || item.menuItem.price) * item.quantity)}
                </Text>
              </View>

              {/* Stepper tăng giảm */}
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => updateQuantity(item.id || item.menuItem.id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={14} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepCount}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => updateQuantity(item.id || item.menuItem.id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>

        {/* Mục 3: Gợi ý gọi thêm (Also ordered - Trang 8) */}
        <View style={styles.alsoOrderedWrap}>
          <Text style={styles.alsoOrderedHeading}>Gợi ý gọi thêm món ngon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {ALSO_ORDERED.map((ao) => (
              <View key={ao.id} style={styles.alsoOrderedCard}>
                <Image source={{ uri: ao.imageUrl }} style={styles.aoImage} />
                <Text style={styles.aoName} numberOfLines={1}>
                  {ao.name}
                </Text>
                <View style={styles.aoBottom}>
                  <Text style={styles.aoPrice}>{formatVND(ao.price)}</Text>
                  <TouchableOpacity
                    style={styles.aoAddBtn}
                    onPress={() => Alert.alert('Đã thêm', `Đã thêm ${ao.name} vào đơn!`)}
                  >
                    <Ionicons name="add" size={16} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Mục 4: Mã giảm giá & Phương thức thanh toán (Trang 8) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardSectionHeading}>Ưu đãi & Thanh toán</Text>

          {/* Chọn Voucher */}
          <TouchableOpacity style={styles.selectRow} onPress={handleOpenVoucherSelect}>
            <View style={styles.selectRowLeft}>
              <View style={styles.iconBoxOrange}>
                <Ionicons name="ticket-outline" size={18} color="#EE4D2D" />
              </View>
              <View>
                <Text style={styles.selectRowTitle}>
                  {selectedVoucher ? selectedVoucher.code : 'Chọn mã giảm giá (Voucher)'}
                </Text>
                <Text style={styles.selectRowSubtitle}>
                  {selectedVoucher ? selectedVoucher.title : 'Nhiều mã Freeship & Giảm 30k'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Phương thức thanh toán */}
          <Text style={[styles.subHeading, { marginTop: 4 }]}>Phương thức thanh toán</Text>

          <TouchableOpacity
            style={[styles.payMethodOption, paymentMethod === 'COD' && styles.payMethodActive]}
            onPress={() => setPaymentMethod('COD')}
          >
            <Ionicons
              name={paymentMethod === 'COD' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={paymentMethod === 'COD' ? '#EE4D2D' : colors.textMuted}
            />
            <Ionicons name="cash-outline" size={22} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.payName}>Tiền mặt khi nhận hàng (COD)</Text>
              <Text style={styles.payDesc}>Thanh toán cho tài xế sau khi nhận đồ ăn</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payMethodOption, paymentMethod === 'VNPAY' && styles.payMethodActive]}
            onPress={() => setPaymentMethod('VNPAY')}
          >
            <Ionicons
              name={paymentMethod === 'VNPAY' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={paymentMethod === 'VNPAY' ? '#EE4D2D' : colors.textMuted}
            />
            <Ionicons name="card-outline" size={22} color="#3B82F6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.payName}>Ví điện tử & Thẻ ngân hàng (VNPay)</Text>
              <Text style={styles.payDesc}>Thanh toán bảo mật qua VNPay Sandbox</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Mục 5: Ghi chú đơn hàng */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardSectionHeading}>Ghi chú cho quán & Tài xế</Text>
          <TextInput
            placeholder="Ví dụ: Giao lên lầu 3, quán bỏ ít cay giúp mình..."
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
            style={styles.noteInputBox}
          />
        </Card>

        {/* Mục 6: Chi tiết hoá đơn & Tóm tắt (Trang 8) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardSectionHeading}>Tóm tắt thanh toán</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Tạm tính ({items.length} món)</Text>
            <Text style={styles.billValue}>{formatVND(subtotal)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Khoảng cách giao hàng</Text>
            <Text style={styles.billValue}>{distanceKm} km</Text>
          </View>

          <View style={styles.billRow}>
            <View>
              <Text style={styles.billLabel}>Phí giao hàng</Text>
              <Text style={[styles.peakBadge, isPeak && styles.peakBadgeActive]}>
                {isPeak
                  ? '⚡ Giờ cao điểm (11-13h & 17h30-19h30): 10.000đ/km'
                  : 'Giờ thường: 5.000đ/km'}
              </Text>
            </View>
            <Text style={styles.billValue}>{formatVND(deliveryFee)}</Text>
          </View>

          {discountAmount > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#10B981', fontWeight: '600' }]}>
                Giảm giá voucher ({selectedVoucher?.code})
              </Text>
              <Text style={[styles.billValue, { color: '#10B981', fontWeight: '700' }]}>
                -{formatVND(discountAmount)}
              </Text>
            </View>
          )}

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.totalValue}>{formatVND(grandTotal)}</Text>
          </View>
        </Card>
      </ScrollView>

      {/* Nút đặt đơn màu Cam nổi bật (Trang 8) */}
      <View style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.orderBtn, isSubmitting && styles.orderBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <Text style={styles.orderBtnText}>
            {isSubmitting ? 'Đang gửi đơn hàng...' : `Đặt hàng ngay • ${formatVND(grandTotal)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { padding: 14, paddingBottom: 110 },
  sectionCard: { padding: 14, marginBottom: 12, borderRadius: 14 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionHeading: { fontSize: 16, fontWeight: '800', color: colors.text },
  editAddressLink: { fontSize: 13, color: '#EE4D2D', fontWeight: '700' },
  addMoreLink: { fontSize: 13, color: '#EE4D2D', fontWeight: '700' },
  addressBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLine: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  deliveryTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  deliveryTimeText: { fontSize: 12, color: '#EE4D2D', fontWeight: '600' },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  itemThumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#E5E7EB' },
  itemInfoCol: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  itemLineTotal: { fontSize: 13, fontWeight: '700', color: '#EE4D2D', marginTop: 2 },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 2,
  },
  stepBtn: { padding: 6 },
  stepCount: { fontSize: 13, fontWeight: '700', paddingHorizontal: 6, color: colors.text },
  alsoOrderedWrap: { marginBottom: 14 },
  alsoOrderedHeading: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  alsoOrderedCard: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  aoImage: { width: '100%', height: 75, borderRadius: 8, marginBottom: 6 },
  aoName: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 4 },
  aoBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aoPrice: { fontSize: 12, fontWeight: '800', color: '#EE4D2D' },
  aoAddBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  selectRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBoxOrange: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  selectRowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  subHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  payMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 8,
  },
  payMethodActive: { borderColor: '#EE4D2D', backgroundColor: '#FFFBF9' },
  payName: { fontSize: 13, fontWeight: '700', color: colors.text },
  payDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  noteInputBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 13,
    color: colors.text,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  billLabel: { fontSize: 13, color: colors.textSecondary },
  billValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  peakBadge: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  peakBadgeActive: { color: '#EE4D2D', fontWeight: '600' },
  billDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#EE4D2D' },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  orderBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  orderBtnDisabled: { backgroundColor: '#E5E7EB' },
  orderBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
