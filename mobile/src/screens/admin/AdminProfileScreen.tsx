import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  const handleLogout = () => {
    Alert.alert('Đăng xuất Quản trị', 'Bạn có chắc chắn muốn đăng xuất khỏi quyền Admin?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const handleClearCache = () => {
    queryClient.clear();
    Alert.alert('Thành công', 'Đã xoá bộ nhớ tạm (cache) và làm mới toàn bộ truy vấn hệ thống.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="shield-checkmark" size={36} color={colors.white} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.fullName || 'Quản trị viên'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              <Badge variant="danger" label="Quản trị viên (ADMIN)" />
            </View>
          </View>
        </Card>

        {/* Thông tin hệ thống */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông số hệ thống</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Môi trường:</Text>
            <Text style={styles.infoValue}>Development (Local)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cơ sở dữ liệu:</Text>
            <Text style={styles.infoValue}>PostgreSQL (Docker :5433)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kết nối Realtime:</Text>
            <Badge variant="success" label="Socket.IO Online" />
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phiên bản Mobile:</Text>
            <Text style={styles.infoValue}>Expo SDK 52 (v1.0.0)</Text>
          </View>
        </Card>

        {/* Công cụ vận hành */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tài khoản & Vận hành</Text>

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

          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
            <View style={styles.menuLeft}>
              <Ionicons name="trash-bin-outline" size={20} color={colors.warning} />
              <Text style={styles.menuLabel}>Làm sạch bộ nhớ đệm (Clear Cache)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                'Tài khoản Demo',
                'Hệ thống cung cấp sẵn 4 tài khoản thử nghiệm:\n• Khách: customer@fooddelivery.com\n• Quán: owner@fooddelivery.com\n• Xế: driver@fooddelivery.com\n• Admin: admin@fooddelivery.com\n(Mật khẩu chung: Password123!)',
              )
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.info} />
              <Text style={styles.menuLabel}>Xem danh sách tài khoản Demo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Nút đăng xuất */}
        <Button
          label="Đăng xuất khỏi quyền Admin"
          variant="outline"
          icon="log-out-outline"
          onPress={handleLogout}
          style={styles.logoutButton}
        />
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
    backgroundColor: colors.danger,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
});

