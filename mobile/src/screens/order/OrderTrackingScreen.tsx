import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppMapView } from '../../components/common/AppMapView';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useSocket } from '../../hooks/useSocket';
import { useCancelOrder, useOrderDetail } from '../../services/useOrders';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderTracking'>;

const TRACKING_STEPS = [
  { key: 'CONFIRMED', label: 'Xác nhận', icon: 'checkmark-circle' },
  { key: 'LOOKING', label: 'Tìm tài xế', icon: 'search' },
  { key: 'PREPARING', label: 'Chuẩn bị món', icon: 'restaurant' },
  { key: 'PICKED_UP', label: 'Đang giao', icon: 'bicycle' },
  { key: 'DELIVERED', label: 'Hoàn thành', icon: 'home' },
];

export const OrderTrackingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { data: order, isLoading, refetch } = useOrderDetail(orderId);
  const cancelMutation = useCancelOrder();
  const { socket, joinOrder, leaveOrder } = useSocket();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    joinOrder(orderId);

    const handleDriverLoc = (data: { orderId: string; lat: number; lng: number }) => {
      if (data.orderId === orderId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    };

    socket?.on('driver:location', handleDriverLoc);

    return () => {
      leaveOrder(orderId);
      socket?.off('driver:location', handleDriverLoc);
    };
  }, [orderId, socket]);

  const handleCancel = () => {
    Alert.alert('Xác nhận hủy đơn', 'Bạn có chắc chắn muốn hủy đơn hàng này không?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelMutation.mutateAsync(orderId);
            refetch();
          } catch (err: any) {
            Alert.alert('Không thể hủy đơn', err.response?.data?.message || 'Quán đã tiếp nhận đơn.');
          }
        },
      },
    ]);
  };

  const handleOpenChat = () => {
    navigation.navigate('Chat', {
      orderId,
      recipientName: order?.driver?.fullName || 'Tài xế giao hàng',
      recipientRole: 'Tài xế phụ trách đơn',
    });
  };

  const handleOpenCall = () => {
    navigation.navigate('DriverCall', {
      orderId,
      driverName: order?.driver?.fullName || 'Tài xế giao hàng',
      driverPhone: order?.driver?.phone || '0908 123 456',
    });
  };

  const handleOpenRating = () => {
    navigation.navigate('Rating', {
      orderId,
      driverName: order?.driver?.fullName || 'Tài xế',
      restaurantName: order?.restaurant?.name,
    });
  };

  if (isLoading || !order) {
    return <LoadingSpinner message="Đang tải dữ liệu đơn hàng..." />;
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status];

  // Tính bước tiến trình hiện tại (0 - 4)
  const getStepIndex = () => {
    switch (order.status) {
      case 'PENDING':
        return 0;
      case 'CONFIRMED':
        return 1;
      case 'PREPARING':
      case 'READY_FOR_PICKUP':
        return 2;
      case 'PICKED_UP':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex();

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Theo dõi đơn hàng</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Trợ giúp đơn hàng',
              'Nếu cần hỗ trợ gấp về đơn hàng, vui lòng liên hệ hotline CSKH: 1900 6868.',
            )
          }
        >
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bản đồ định vị live (Trang 10) */}
        <View style={styles.mapContainer}>
          <AppMapView
            style={styles.map}
            initialRegion={{
              latitude: order.restaurant.latitude,
              longitude: order.restaurant.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            markers={[
              {
                id: 'restaurant',
                latitude: order.restaurant.latitude,
                longitude: order.restaurant.longitude,
                title: order.restaurant.name,
                description: 'Điểm lấy món',
                pinColor: 'red',
              },
              {
                id: 'delivery',
                latitude: order.deliveryLat,
                longitude: order.deliveryLng,
                title: 'Điểm giao hàng',
                description: order.deliveryAddress,
                pinColor: 'blue',
              },
              ...(driverLocation
                ? [
                    {
                      id: 'driver',
                      latitude: driverLocation.lat,
                      longitude: driverLocation.lng,
                      title: order.driver?.fullName || 'Tài xế',
                      description: 'Đang di chuyển',
                      pinColor: 'green',
                    },
                  ]
                : []),
            ]}
          />
        </View>

        {/* Thanh tiến trình 5 bước trực quan theo Trang 9 */}
        <Card style={styles.progressCard}>
          <View style={styles.stepTitleRow}>
            <Text style={styles.stepMainHeading}>{statusConfig.label}</Text>
            <Badge
              label={order.status === 'PENDING' ? 'Chờ duyệt' : 'Đang xử lý'}
              color={statusConfig.color}
              bgColor={statusConfig.bgColor}
            />
          </View>

          {/* Stepper bar */}
          <View style={styles.stepperContainer}>
            {TRACKING_STEPS.map((step, idx) => {
              const isActive = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isCurrent && styles.stepCircleCurrent,
                    ]}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={14}
                      color={isActive ? colors.white : colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Thẻ Tài xế kèm nút Gọi & Chat (Trang 10) */}
        {order.driver ? (
          <Card style={styles.driverCard}>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {order.driver.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{order.driver.fullName}</Text>
                <Text style={styles.driverRole}>Tài xế giao hàng ShopeeFood</Text>
                <Text style={styles.driverSubTime}>Dự kiến giao: 15 - 20 phút</Text>
              </View>

              <View style={styles.driverActions}>
                <TouchableOpacity style={styles.actionCircleBtn} onPress={handleOpenCall}>
                  <Ionicons name="call" size={20} color="#EE4D2D" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionCircleBtn} onPress={handleOpenChat}>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#EE4D2D" />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.lookingDriverCard}>
            <View style={styles.lookingRow}>
              <View style={styles.magnifierCircle}>
                <Ionicons name="search" size={26} color="#EE4D2D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lookingTitle}>Đang tìm tài xế gần quán...</Text>
                <Text style={styles.lookingDesc}>
                  Hệ thống đang tự động điều phối tài xế phù hợp nhất cho đơn của bạn.
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Nút đánh giá dịch vụ nếu đơn đã hoàn thành (Trang 12) */}
        {order.status === 'DELIVERED' && (
          <TouchableOpacity style={styles.rateServiceBtn} onPress={handleOpenRating}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.rateServiceText}>Đánh giá tài xế & Món ăn</Text>
            <Ionicons name="chevron-forward" size={18} color="#EE4D2D" />
          </TouchableOpacity>
        )}

        {/* Địa chỉ giao hàng */}
        <Card style={styles.addressCard}>
          <Text style={styles.cardHeading}>Địa chỉ nhận hàng</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-sharp" size={20} color="#EE4D2D" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLine}>{order.deliveryAddress}</Text>
              {order.note ? <Text style={styles.orderNote}>Ghi chú: {order.note}</Text> : null}
            </View>
          </View>
        </Card>

        {/* Chi tiết đơn hàng */}
        <Card style={styles.billCard}>
          <Text style={styles.cardHeading}>Chi tiết đơn hàng • {order.restaurant.name}</Text>

          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatVND(item.lineTotal)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryVal}>{formatVND(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí giao hàng ({order.distanceKm} km)</Text>
            <Text style={styles.summaryVal}>{formatVND(order.deliveryFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalVal}>{formatVND(order.total)}</Text>
          </View>
        </Card>

        {/* Nút hủy đơn hàng nếu đơn PENDING */}
        {order.status === 'PENDING' && (
          <Button
            title="✕ Hủy đơn hàng"
            variant="outline"
            onPress={handleCancel}
            loading={cancelMutation.isPending}
            style={{
              marginHorizontal: 16,
              marginBottom: 30,
              borderColor: colors.danger,
            }}
            textStyle={{ color: colors.danger }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { paddingBottom: 40 },
  mapContainer: { height: 210, width: '100%' },
  map: { width: '100%', height: '100%' },
  progressCard: {
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  stepTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  stepMainHeading: { fontSize: 17, fontWeight: '800', color: colors.text },
  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepItem: { alignItems: 'center', width: '20%' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: { backgroundColor: '#EE4D2D' },
  stepCircleCurrent: {
    borderWidth: 2,
    borderColor: '#FFF0ED',
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stepLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  stepLabelActive: { color: colors.text, fontWeight: '600' },
  stepLabelCurrent: { color: '#EE4D2D', fontWeight: '800' },
  driverCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '700', color: colors.text },
  driverRole: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  driverSubTime: { fontSize: 11, color: '#EE4D2D', fontWeight: '600', marginTop: 2 },
  driverActions: { flexDirection: 'row', gap: 8 },
  actionCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookingDriverCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14 },
  lookingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  magnifierCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookingTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  lookingDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  rateServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFF0ED',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD5CC',
  },
  rateServiceText: { fontSize: 14, fontWeight: '700', color: '#EE4D2D' },
  addressCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14 },
  cardHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  addressRow: { flexDirection: 'row', gap: 8 },
  addressLine: { fontSize: 13, color: colors.text, lineHeight: 18, fontWeight: '500' },
  orderNote: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  billCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 16, padding: 14, borderRadius: 14 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: 13, color: colors.text, flex: 1, marginRight: 8 },
  itemPrice: { fontSize: 13, color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryVal: { fontSize: 13, color: colors.text, fontWeight: '600' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalVal: { fontSize: 16, fontWeight: '800', color: '#EE4D2D' },
});
