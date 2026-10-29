import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ordersApi } from '../../api/orders';
import { restaurantsApi } from '../../api/restaurants';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useSocket } from '../../hooks/useSocket';
import { OrderDetail, OrderStatus } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';

const STATUS_TABS: { label: string; value?: OrderStatus }[] = [
  { label: 'Tất cả' },
  { label: 'Chờ nhận', value: 'PENDING' },
  { label: 'Đang chuẩn bị món', value: 'PREPARING' },
  { label: 'Chờ tài xế', value: 'READY_FOR_PICKUP' },
  { label: 'Đang giao', value: 'PICKED_UP' },
  { label: 'Hoàn thành', value: 'DELIVERED' },
];

export const OwnerOrdersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Lấy quán của chủ quán
  const { data: restaurants, isLoading: loadingRest } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });

  const restaurant = restaurants?.[0];

  // 2. Lấy đơn hàng của quán
  const {
    data: ordersData,
    isLoading: loadingOrders,
    refetch,
  } = useQuery({
    queryKey: ['owner', 'orders', restaurant?.id, selectedStatus],
    queryFn: () =>
      restaurant
        ? restaurantsApi.getRestaurantOrders(restaurant.id, {
            status: selectedStatus,
            limit: 50,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, limit: 50, hasMore: false }),
    enabled: Boolean(restaurant?.id),
    refetchInterval: 10000,
  });

  // Lắng nghe Socket để cập nhật đơn mới tức thời
  useEffect(() => {
    const handleOrderUpdate = () => {
      refetch();
    };

    socket?.on('order:created', handleOrderUpdate);
    socket?.on('order:status', handleOrderUpdate);
    socket?.on('order:driver_assigned', handleOrderUpdate);

    return () => {
      socket?.off('order:created', handleOrderUpdate);
      socket?.off('order:status', handleOrderUpdate);
      socket?.off('order:driver_assigned', handleOrderUpdate);
    };
  }, [socket, refetch]);

  // Mutation cập nhật trạng thái đơn
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
    },
    onError: (err: any) => {
      Alert.alert('Lỗi cập nhật', err.response?.data?.message || 'Không thể chuyển trạng thái đơn');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateStatus = (order: OrderDetail, nextStatus: OrderStatus, actionName: string) => {
    Alert.alert('Xác nhận', `Bạn muốn chuyển đơn sang: "${actionName}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        onPress: () => updateStatusMutation.mutate({ id: order.id, status: nextStatus }),
      },
    ]);
  };

  if (loadingRest) {
    return <LoadingSpinner message="Đang tải dữ liệu nhà hàng..." />;
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<Ionicons name="storefront-outline" size={64} color={colors.textMuted} />}
          title="Bạn chưa có nhà hàng nào"
          description="Vui lòng liên hệ Quản trị viên để đăng ký mở quán trên hệ thống."
        />
      </SafeAreaView>
    );
  }

  const orders = ordersData?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Quán */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Quản lý đơn hàng</Text>
          <Text style={styles.headerTitle}>{restaurant.name}</Text>
        </View>
        <Badge
          label={restaurant.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa'}
          color={restaurant.isOpen ? colors.success : colors.danger}
          bgColor={restaurant.isOpen ? '#D1FAE5' : '#FEE2E2'}
        />
      </View>

      {/* Bộ lọc trạng thái */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.tabsList}
          renderItem={({ item }) => {
            const isActive = selectedStatus === item.value;
            return (
              <TouchableOpacity
                style={[styles.tabChip, isActive && styles.tabChipActive]}
                onPress={() => setSelectedStatus(item.value)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Danh sách đơn */}
      {loadingOrders ? (
        <LoadingSpinner message="Đang tải danh sách đơn..." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const statusConfig = ORDER_STATUS_CONFIG[item.status];
            return (
              <Card style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>Mã đơn: #{item.id.slice(0, 8)}</Text>
                    <Text style={styles.orderTime}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Badge
                    label={statusConfig.label}
                    color={statusConfig.color}
                    bgColor={statusConfig.bgColor}
                  />
                </View>

                {/* Khách hàng */}
                <View style={styles.customerRow}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.customerText}>
                    {item.customer?.fullName} • {item.customer?.phone || 'Chưa có SĐT'}
                  </Text>
                </View>

                {/* Danh sách món */}
                <View style={styles.itemsBox}>
                  {item.items?.map((m) => (
                    <View key={m.id} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        <Text style={{ fontWeight: '700' }}>{m.quantity}x </Text>
                        {m.name}
                        {m.note ? ` (${m.note})` : ''}
                      </Text>
                      <Text style={styles.itemPrice}>{formatVND(m.lineTotal)}</Text>
                    </View>
                  ))}
                </View>

                {/* Tài xế nếu đã có */}
                {item.driver && (
                  <View style={styles.driverRow}>
                    <Ionicons name="bicycle" size={16} color={colors.primary} />
                    <Text style={styles.driverText}>
                      Tài xế: {item.driver.fullName} ({item.driver.phone || 'Đang đến quán'})
                    </Text>
                  </View>
                )}

                {/* Tổng tiền & Nút Thao tác */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.totalLabel}>Tổng đơn</Text>
                    <Text style={styles.totalValue}>{formatVND(item.total)}</Text>
                  </View>

                  <View style={styles.actionsRow}>
                    {item.status === 'PENDING' && (
                      <Button
                        title="Nhận đơn"
                        size="small"
                        onPress={() => handleUpdateStatus(item, 'CONFIRMED', 'Đã nhận đơn')}
                      />
                    )}
                    {item.status === 'CONFIRMED' && (
                      <Button
                        title="Chuẩn bị món"
                        size="small"
                        onPress={() => handleUpdateStatus(item, 'PREPARING', 'Đang chuẩn bị món')}
                      />
                    )}
                    {item.status === 'PREPARING' && (
                      <Button
                        title="Món đã xong"
                        size="small"
                        variant="secondary"
                        onPress={() => handleUpdateStatus(item, 'READY_FOR_PICKUP', 'Chờ tài xế')}
                      />
                    )}
                    {item.status === 'PENDING' && (
                      <Button
                        title="Từ chối"
                        size="small"
                        variant="danger"
                        onPress={() => handleUpdateStatus(item, 'CANCELLED', 'Hủy đơn')}
                      />
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="receipt-outline" size={48} color={colors.textMuted} />}
              title="Chưa có đơn hàng nào"
              description="Các đơn đặt món của khách hàng sẽ xuất hiện tại đây theo thời gian thực."
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerSubtitle: { fontSize: 12, color: colors.textMuted },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  tabsContainer: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tabsList: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  list: { padding: 16 },
  orderCard: { marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  customerText: { fontSize: 13, color: colors.textSecondary },
  itemsBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 10, gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 13, color: colors.text, flex: 1, marginRight: 8 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: colors.text },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  driverText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  totalLabel: { fontSize: 11, color: colors.textMuted },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  actionsRow: { flexDirection: 'row', gap: 8 },
});

