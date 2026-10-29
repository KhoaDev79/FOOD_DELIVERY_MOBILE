import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ordersApi } from '../../api/orders';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { formatVND } from '../../utils/format';

export const DriverProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Lấy danh sách chuyến đã giao để tính thống kê
  const { data: deliveredOrders } = useQuery({
    queryKey: ['driver', 'stats'],
    queryFn: () => ordersApi.getDeliveries({ status: 'DELIVERED', limit: 100 }),
  });

  const totalDelivered = deliveredOrders?.items?.length || 0;
  // Ước tính thu nhập ship: 15.000đ / đơn hoặc tổng phí ship
  const totalEarnings = deliveredOrders?.items?.reduce(
    (sum, o) => sum + (o.deliveryFee || 15000),
    0,
  ) || 0;

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản tài xế?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const handleSupport = () => {
    Alert.alert(
      'Tổng đài hỗ trợ đối tác',
      'Hotline: 1900 6868\nThời gian hỗ trợ: 24/7\n\nBạn có muốn gọi ngay không?',
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Gọi 1900 6868', onPress: () => Linking.openURL('tel:19006868') },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={36} color={colors.white} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.fullName || 'Tài xế Food Delivery'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
            <View style={styles.badgeRow}>
              <Badge variant="primary" label="Tài xế đối tác" />
              <View style={styles.statusChip}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Đang hoạt động</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statBox}>
            <Ionicons name="bicycle" size={24} color={colors.primary} />
            <Text style={styles.statNumber}>{totalDelivered}</Text>
            <Text style={styles.statLabel}>Đơn đã giao</Text>
          </Card>

          <Card style={styles.statBox}>
            <Ionicons name="wallet-outline" size={24} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {formatVND(totalEarnings)}
            </Text>
            <Text style={styles.statLabel}>Thu nhập ship</Text>
          </Card>

          <Card style={styles.statBox}>
            <Ionicons name="star" size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>5.0 ★</Text>
            <Text style={styles.statLabel}>Đánh giá</Text>
          </Card>
        </View>

        {/* Thông tin phương tiện */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin phương tiện</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Loại xe:</Text>
            <Text style={styles.infoValue}>Xe máy (Honda Wave Alpha)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Biển số xe:</Text>
            <Text style={styles.infoValue}>29-H1 888.88</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trạng thái hồ sơ:</Text>
            <Badge variant="success" label="Đã xác thực CCCD & GPLX" />
          </View>
        </Card>

        {/* Menu cài đặt & trợ giúp */}
        <Card style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.menuLabel}>Thông tin cá nhân & Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleSupport}>
            <View style={styles.menuLeft}>
              <Ionicons name="headset-outline" size={20} color={colors.primary} />
              <Text style={styles.menuLabel}>Tổng đài hỗ trợ 24/7</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                'Quy trình giao hàng',
                '1. Tab "Tìm đơn": Bấm nhận chuyến khả dụng.\n2. Di chuyển đến nhà hàng và đợi món nấu xong.\n3. Nhận món, bấm "Đã lấy món".\n4. Giao đến địa chỉ khách hàng.\n5. Thu tiền (nếu COD) và bấm "Giao hàng thành công".',
              )
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="help-circle-outline" size={20} color={colors.info} />
              <Text style={styles.menuLabel}>Quy trình & Hướng dẫn nhận đơn</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Nút đăng xuất */}
        <Button
          label="Đăng xuất tài khoản"
          variant="outline"
          icon="log-out-outline"
          onPress={handleLogout}
          style={styles.logoutButton}
        />

        <Text style={styles.versionText}>Food Delivery Driver App • Phiên bản 1.0.0</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 10,
  },
  logoutButton: {
    marginTop: 8,
    borderColor: colors.danger,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 20,
  },
});

