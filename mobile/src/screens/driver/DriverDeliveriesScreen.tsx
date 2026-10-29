import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ordersApi } from '../../api/orders';
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

type DeliveryTab = 'ACTIVE' | 'COMPLETED';

export const DriverDeliveriesScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<DeliveryTab>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);

  // Lấy danh sách chuyến giao của tài xế
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'deliveries', activeTab],
    queryFn: () =>
      ordersApi.getDeliveries({
        status: activeTab === 'COMPLETED' ? 'DELIVERED' : undefined,
        limit: 50,
      }),
    refetchInterval: 10000,
  });

  // Socket lắng nghe thay đổi trạng thái
  useEffect(() => {
    const handleOrderUpdate = () => {
      refetch();
    };

    socket?.on('order:status', handleOrderUpdate);
    socket?.on('order:driver_assigned', handleOrderUpdate);

    return () => {
      socket?.off('order:status', handleOrderUpdate);
      socket?.off('order:driver_assigned', handleOrderUpdate);
    };
  }, [socket, refetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Mutation cập nhật trạng thái đơn: PICKED_UP hoặc DELIVERED
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, nextStatus }: { orderId: string; nextStatus: OrderStatus }) =>
      ordersApi.updateStatus(orderId, nextStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['driver', 'available'] });
      Alert.alert(
        'Thành công',
        `Đơn hàng #${updated.id.slice(-6).toUpperCase()} đã cập nhật trạng thái sang "${
          ORDER_STATUS_CONFIG[updated.status]?.label || updated.status
        }"`,
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể cập nhật trạng thái đơn';
      Alert.alert('Lỗi cập nhật', msg);
      refetch();
    },
  });

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Số điện thoại không khả dụng');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleAction = (order: OrderDetail) => {
    if (order.status === 'CONFIRMED' || order.status === 'PREPARING') {
      Alert.alert(
        'Chờ nhà hàng chuẩn bị',
        'Quán ăn đang chuẩn bị món. Vui lòng di chuyển đến quán và chờ quán báo "Sẵn sàng lấy món" rồi mới bấm nhận.',
      );
      return;
    }

    if (order.status === 'READY_FOR_PICKUP') {
      Alert.alert(
        'Xác nhận lấy món',
        `Bạn đã nhận đủ món của đơn #${order.id.slice(-6).toUpperCase()} từ quán ${
          order.restaurant?.name || ''
        } và bắt đầu đi giao?`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Đã lấy món & Đi giao',
            style: 'default',
            onPress: () =>
              updateStatusMutation.mutate({ orderId: order.id, nextStatus: 'PICKED_UP' }),
          },
        ],
      );
      return;
    }

    if (order.status === 'PICKED_UP') {
      const codNotice =
        order.paymentMethod === 'COD'
          ? `\n\nLƯU Ý: Vui lòng thu tiền mặt của khách: ${formatVND(order.total)}`
          : '\n\nĐơn đã thanh toán Online, không thu thêm tiền của khách.';

      Alert.alert(
        'Xác nhận giao hàng thành công',
        `Bạn đã giao thành công đơn hàng #${order.id.slice(-6).toUpperCase()} cho khách?${codNotice}`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Xác nhận hoàn thành',
            style: 'default',
            onPress: () =>
              updateStatusMutation.mutate({ orderId: order.id, nextStatus: 'DELIVERED' }),
          },
        ],
      );
    }
  };

  const renderOrderItem = ({ item }: { item: OrderDetail }) => {
    const statusCfg = ORDER_STATUS_CONFIG[item.status] || {
      label: item.status,
      color: colors.textSecondary,
      bgColor: colors.borderLight,
    };
    const itemCount = item.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Đơn #{item.id.slice(-6).toUpperCase()}</Text>
            <Text style={styles.orderTime}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <Badge label={statusCfg.label} color={statusCfg.color} bgColor={statusCfg.bgColor} />
        </View>

        <View style={styles.divider} />

        {/* Thông tin Quán lấy hàng */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <Text style={styles.locationTitle}>Quán: {item.restaurant?.name || 'Nhà hàng'}</Text>
          </View>
          <Text style={styles.locationAddress}>{item.restaurant?.address || 'Địa chỉ quán'}</Text>
        </View>

        {/* Thông tin Khách nhận hàng */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={styles.locationTitle}>Khách: {item.customer?.fullName || 'Khách hàng'}</Text>
            {item.customer?.phone && (
              <TouchableOpacity
                onPress={() => handleCall(item.customer?.phone)}
                style={styles.callButton}
              >
                <Ionicons name="call" size={14} color={colors.white} />
                <Text style={styles.callButtonText}>Gọi khách</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.locationAddress}>{item.deliveryAddress}</Text>
          {item.note ? (
            <Text style={styles.noteText}>Ghi chú: {item.note}</Text>
          ) : null}
        </View>

        {/* Tóm tắt món */}
        <View style={styles.itemsBox}>
          <Text style={styles.itemsBoxTitle}>Danh sách món ({itemCount}):</Text>
          {item.items?.map((it, idx) => (
            <Text key={idx} style={styles.itemLine}>
              • {it.quantity}x {it.name}
            </Text>
          ))}
        </View>

        {/* Thông tin tiền thanh toán */}
        <View style={styles.paymentBox}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Hình thức:</Text>
            <Text style={styles.paymentMethodText}>
              {item.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : item.paymentMethod}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Cần thu khách:</Text>
            <Text
              style={[
                styles.paymentAmount,
                item.paymentMethod === 'COD' ? { color: colors.danger } : { color: colors.success },
              ]}
            >
              {item.paymentMethod === 'COD' ? formatVND(item.total) : '0 ₫ (Đã thanh toán)'}
            </Text>
          </View>
        </View>

        {/* Action Button theo trạng thái nếu đang ở tab ACTIVE */}
        {activeTab === 'ACTIVE' && item.status !== 'DELIVERED' && (
          <View style={styles.actionContainer}>
            {item.status === 'CONFIRMED' || item.status === 'PREPARING' ? (
              <Button
                label="Đang nấu — Chờ lấy món"
                variant="outline"
                icon="time-outline"
                fullWidth
                onPress={() => handleAction(item)}
              />
            ) : item.status === 'READY_FOR_PICKUP' ? (
              <Button
                label="Món đã xong — Bấm Đã lấy món"
                variant="primary"
                icon="bicycle-outline"
                fullWidth
                loading={updateStatusMutation.isPending}
                onPress={() => handleAction(item)}
              />
            ) : item.status === 'PICKED_UP' ? (
              <Button
                label="Đã đến nơi — Hoàn tất giao hàng"
                variant="primary"
                icon="checkmark-circle-outline"
                fullWidth
                loading={updateStatusMutation.isPending}
                onPress={() => handleAction(item)}
                style={{ backgroundColor: colors.success }}
              />
            ) : null}
          </View>
        )}
      </Card>
    );
  };

  const rawOrders = ordersData?.items || [];
  // Lọc theo tab
  const displayedOrders = rawOrders.filter((order) => {
    if (activeTab === 'ACTIVE') {
      return order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
    }
    return order.status === 'DELIVERED';
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Switch Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ACTIVE' && styles.activeTabItem]}
          onPress={() => setActiveTab('ACTIVE')}
        >
          <Text style={[styles.tabText, activeTab === 'ACTIVE' && styles.activeTabText]}>
            Đang thực hiện
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'COMPLETED' && styles.activeTabItem]}
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.activeTabText]}>
            Lịch sử đã giao
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải danh sách chuyến..." />
      ) : (
        <FlatList
          data={displayedOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'ACTIVE' ? 'Chưa có đơn đang giao' : 'Chưa có lịch sử giao hàng'}
              message={
                activeTab === 'ACTIVE'
                  ? 'Bạn chưa nhận chuyến nào. Vui lòng sang tab "Tìm đơn" để nhận đơn mới.'
                  : 'Các chuyến bạn giao thành công sẽ hiển thị tại đây.'
              }
              actionLabel="Tải lại"
              onAction={onRefresh}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  orderTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  locationSection: {
    marginBottom: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  callButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 4,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 14,
  },
  noteText: {
    fontSize: 11,
    color: colors.warning,
    fontStyle: 'italic',
    marginLeft: 14,
    marginTop: 2,
  },
  itemsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  itemsBoxTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  itemLine: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 2,
  },
  paymentBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  paymentLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionContainer: {
    marginTop: 8,
  },
});

