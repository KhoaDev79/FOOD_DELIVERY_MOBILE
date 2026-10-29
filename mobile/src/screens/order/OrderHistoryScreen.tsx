import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useMyOrders } from '../../services/useOrders';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime, formatVND } from '../../utils/format';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';

export const OrderHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useMyOrders();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const orders = data?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
      </View>

      {isLoading ? (
        <LoadingSpinner message="Đang tải lịch sử đơn hàng..." />
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
              <Card
                style={styles.orderCard}
                onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {item.restaurant.name}
                  </Text>
                  <Badge
                    label={statusConfig.label}
                    color={statusConfig.color}
                    bgColor={statusConfig.bgColor}
                  />
                </View>

                <Text style={styles.orderDate}>{formatDateTime(item.createdAt)}</Text>

                <View style={styles.itemsSummary}>
                  <Text style={styles.itemsText} numberOfLines={2}>
                    {item.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </Text>
                </View>

                <View style={styles.orderCardFooter}>
                  <Text style={styles.totalLabel}>Tổng tiền:</Text>
                  <Text style={styles.totalValue}>{formatVND(item.total)}</Text>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="receipt-outline" size={48} color={colors.textMuted} />}
              title="Chưa có đơn hàng nào"
              description="Những đơn hàng bạn đã đặt sẽ xuất hiện tại đây."
              actionTitle="Đặt món ngay"
              onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
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
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  list: { padding: 16 },
  orderCard: { marginBottom: 12 },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  restaurantName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  orderDate: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  itemsSummary: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  itemsText: { fontSize: 13, color: colors.textSecondary },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.primary },
});

