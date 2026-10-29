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
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useSocket } from '../../hooks/useSocket';
import { OrderDetail } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';

export const DriverAvailableOrdersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [refreshing, setRefreshing] = useState(false);

  // Lấy danh sách đơn hàng đang mở cho tài xế nhận
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'available'],
    queryFn: () => ordersApi.getAvailable({ limit: 50 }),
    refetchInterval: 10000,
  });

  // Lắng nghe Socket để cập nhật danh sách đơn mới ngay tức thì
  useEffect(() => {
    const handleOrderUpdate = () => {
      refetch();
    };

    socket?.on('order:available', handleOrderUpdate);
    socket?.on('order:created', handleOrderUpdate);
    socket?.on('order:status', handleOrderUpdate);
    socket?.on('order:driver_assigned', handleOrderUpdate);

    return () => {
      socket?.off('order:available', handleOrderUpdate);
      socket?.off('order:created', handleOrderUpdate);
      socket?.off('order:status', handleOrderUpdate);
      socket?.off('order:driver_assigned', handleOrderUpdate);
    };
  }, [socket, refetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Mutation nhận đơn
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.acceptOrder(orderId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['driver', 'deliveries'] });
      Alert.alert(
        'Nhận đơn thành công!',
        `Bạn đã nhận đơn #${updated.id.slice(-6).toUpperCase()}. Vui lòng chuyển sang tab "Chuyến của tôi" để tiến hành lấy món và giao hàng.`,
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể nhận đơn. Đơn có thể đã được tài xế khác nhận.';
      Alert.alert('Không thành công', msg);
      refetch();
    },
  });

  const handleAccept = (order: OrderDetail) => {
    Alert.alert(
      'Xác nhận nhận đơn',
      `Bạn có chắc chắn muốn nhận đơn #${order.id.slice(-6).toUpperCase()} từ ${order.restaurant?.name || 'Nhà hàng'}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Nhận đơn ngay',
          style: 'default',
          onPress: () => acceptMutation.mutate(order.id),
        },
      ],
    );
  };

  const renderOrderItem = ({ item }: { item: OrderDetail }) => {
    const statusCfg = ORDER_STATUS_CONFIG[item.status] || {
      label: item.status,
      color: colors.textSecondary,
      bgColor: colors.borderLight,
    };
    const itemCount = item.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
    const itemsPreview = item.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Chi tiết món';

    return (
      <Card style={styles.card}>
        {/* Header đơn */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Đơn #{item.id.slice(-6).toUpperCase()}</Text>
            <Text style={styles.orderTime}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <Badge label={statusCfg.label} color={statusCfg.color} bgColor={statusCfg.bgColor} />
        </View>

        <View style={styles.divider} />

        {/* Điểm lấy hàng: Quán */}
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.warning }]} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>Lấy tại quán:</Text>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {item.restaurant?.name || 'Nhà hàng'}
            </Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {item.restaurant?.address || 'Địa chỉ quán'}
            </Text>
          </View>
        </View>

        {/* Điểm giao hàng: Khách */}
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>Giao đến khách:</Text>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer?.fullName || 'Khách hàng'}
            </Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {item.deliveryAddress}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Thông tin món & tiền */}
        <View style={styles.orderDetailRow}>
          <Ionicons name="fast-food-outline" size={16} color={colors.textMuted} />
          <Text style={styles.itemsSummary} numberOfLines={1}>
            {itemCount} món: {itemsPreview}
          </Text>
        </View>

        <View style={styles.feeContainer}>
          <View style={styles.feeCol}>
            <Text style={styles.feeLabel}>Tiền thu khách:</Text>
            <Text style={styles.feeValue}>
              {item.paymentMethod === 'COD' ? formatVND(item.total) : '0 ₫ (Đã thanh toán)'}
            </Text>
          </View>
          <View style={styles.feeCol}>
            <Text style={styles.feeLabel}>Phí ship nhận:</Text>
            <Text style={[styles.feeValue, { color: colors.success }]}>
              {formatVND(item.deliveryFee || 15000)}
            </Text>
          </View>
        </View>

        {/* Nút nhận đơn */}
        <Button
          label="Nhận chuyến này"
          variant="primary"
          icon="bicycle-outline"
          fullWidth
          loading={acceptMutation.isPending && acceptMutation.variables === item.id}
          onPress={() => handleAccept(item)}
          style={styles.acceptButton}
        />
      </Card>
    );
  };

  const orders = ordersData?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header trạng thái trực tuyến của tài xế */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.onlineBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.onlineText}>Đang trực tuyến</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshIconBtn}>
            <Ionicons name="reload-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Có <Text style={styles.highlightCount}>{orders.length}</Text> đơn hàng đang chờ bạn nhận giao
        </Text>
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang quét các đơn hàng xung quanh..." />
      ) : (
        <FlatList
          data={orders}
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
              title="Chưa có đơn hàng mới"
              message="Hiện chưa có đơn nào sẵn sàng quanh bạn. Hệ thống sẽ tự động cập nhật ngay khi quán xác nhận đơn mới."
              actionLabel="Làm mới danh sách"
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
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  refreshIconBtn: {
    padding: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  highlightCount: {
    fontWeight: '700',
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
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 10,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  routeAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemsSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  feeCol: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  acceptButton: {
    marginTop: 4,
  },
});

