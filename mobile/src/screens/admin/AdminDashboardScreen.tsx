import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '../../api/admin';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { formatVND } from '../../utils/format';

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: stats,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !refreshing) {
    return <LoadingSpinner message="Đang tải dữ liệu tổng quan hệ thống..." />;
  }

  const userRoles = stats?.users.roles || {};
  const orderStatuses = stats?.orders.statuses || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Hệ thống Quản trị</Text>
            <Text style={styles.headerSubtitle}>Tổng quan vận hành toàn sàn Food Delivery</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="reload" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Doanh thu toàn hệ thống */}
        <Card style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Ionicons name="trending-up" size={24} color={colors.white} />
            <Text style={styles.revenueLabel}>Tổng Doanh thu Sàn (GMV)</Text>
          </View>
          <Text style={styles.revenueAmount}>
            {formatVND(stats?.orders.totalRevenue || 0)}
          </Text>
          <Text style={styles.revenueHint}>
            Được tính từ tất cả đơn hàng đã giao thành công
          </Text>
        </Card>

        {/* Grid 4 chỉ số chính */}
        <View style={styles.grid}>
          {/* Card Người dùng */}
          <Card style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="people" size={20} color="#0284C7" />
            </View>
            <Text style={styles.gridNumber}>{stats?.users.total || 0}</Text>
            <Text style={styles.gridLabel}>Người dùng</Text>
            <Text style={styles.gridSub}>
              {userRoles['CUSTOMER'] || 0} khách • {userRoles['RESTAURANT_OWNER'] || 0} quán • {userRoles['DRIVER'] || 0} xế
            </Text>
          </Card>

          {/* Card Quán ăn */}
          <Card style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="restaurant" size={20} color="#D97706" />
            </View>
            <Text style={styles.gridNumber}>{stats?.restaurants.total || 0}</Text>
            <Text style={styles.gridLabel}>Nhà hàng</Text>
            <Text style={styles.gridSub}>
              {stats?.restaurants.open || 0} Đang mở • {stats?.restaurants.closed || 0} Đóng
            </Text>
          </Card>

          {/* Card Đơn hàng */}
          <Card style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="receipt" size={20} color="#16A34A" />
            </View>
            <Text style={styles.gridNumber}>{stats?.orders.total || 0}</Text>
            <Text style={styles.gridLabel}>Tổng đơn hàng</Text>
            <Text style={styles.gridSub}>
              {orderStatuses['DELIVERED'] || 0} hoàn thành
            </Text>
          </Card>

          {/* Card Tỷ lệ thành công */}
          <Card style={styles.gridCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="checkmark-done-circle" size={20} color="#DC2626" />
            </View>
            <Text style={styles.gridNumber}>
              {stats?.orders.total
                ? `${Math.round(((orderStatuses['DELIVERED'] || 0) / stats.orders.total) * 100)}%`
                : '100%'}
            </Text>
            <Text style={styles.gridLabel}>Tỷ lệ giao đạt</Text>
            <Text style={styles.gridSub}>
              {orderStatuses['CANCELLED'] || 0} đơn huỷ
            </Text>
          </Card>
        </View>

        {/* Trạng thái các đơn hàng */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Phân bổ trạng thái đơn</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Chờ quán xác nhận (PENDING)</Text>
            <Text style={styles.statusCount}>{orderStatuses['PENDING'] || 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Đang nấu (PREPARING)</Text>
            <Text style={styles.statusCount}>{orderStatuses['PREPARING'] || 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Chờ tài xế lấy (READY_FOR_PICKUP)</Text>
            <Text style={styles.statusCount}>{orderStatuses['READY_FOR_PICKUP'] || 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Đang trên đường giao (PICKED_UP)</Text>
            <Text style={styles.statusCount}>{orderStatuses['PICKED_UP'] || 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Giao thành công (DELIVERED)</Text>
            <Text style={[styles.statusCount, { color: colors.success }]}>
              {orderStatuses['DELIVERED'] || 0}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusName}>Đã huỷ (CANCELLED)</Text>
            <Text style={[styles.statusCount, { color: colors.danger }]}>
              {orderStatuses['CANCELLED'] || 0}
            </Text>
          </View>
        </Card>

        {/* Lối tắt quản lý */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AdminUsersTab')}
          >
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={styles.actionBtnText}>Quản lý Người dùng</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AdminRestaurantsTab')}
          >
            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
            <Text style={styles.actionBtnText}>Quản lý Quán ăn</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  revenueCard: {
    backgroundColor: '#1E293B',
    padding: 18,
    marginBottom: 16,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  revenueAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#38BDF8',
  },
  revenueHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    padding: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  gridSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
});

