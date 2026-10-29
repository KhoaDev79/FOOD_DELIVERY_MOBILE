import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '../../api/admin';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { Role, User } from '../../types/api';
import { formatDateTime } from '../../utils/format';

const ROLE_FILTERS: { label: string; value?: Role }[] = [
  { label: 'Tất cả' },
  { label: 'Khách hàng', value: 'CUSTOMER' },
  { label: 'Chủ quán', value: 'RESTAURANT_OWNER' },
  { label: 'Tài xế', value: 'DRIVER' },
  { label: 'Quản trị viên', value: 'ADMIN' },
];

export const AdminUsersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: usersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'users', selectedRole, searchQuery],
    queryFn: () =>
      adminApi.listUsers({
        role: selectedRole,
        q: searchQuery.trim() || undefined,
        limit: 50,
      }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: string) => adminApi.toggleUserActive(userId),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      Alert.alert(
        'Thành công',
        `Tài khoản ${updatedUser.fullName} đã được ${
          updatedUser.isActive ? 'kích hoạt hoạt động' : 'khoá tạm thời'
        }.`,
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể đổi trạng thái tài khoản';
      Alert.alert('Lỗi', msg);
    },
  });

  const handleToggle = (u: User) => {
    const actionName = u.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản';
    Alert.alert(
      actionName,
      `Bạn có chắc chắn muốn ${u.isActive ? 'khoá' : 'kích hoạt lại'} tài khoản "${u.fullName}" (${u.email})?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: actionName,
          style: u.isActive ? 'destructive' : 'default',
          onPress: () => toggleActiveMutation.mutate(u.id),
        },
      ],
    );
  };

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="danger" label="Admin" />;
      case 'RESTAURANT_OWNER':
        return <Badge variant="warning" label="Chủ quán" />;
      case 'DRIVER':
        return <Badge variant="info" label="Tài xế" />;
      default:
        return <Badge variant="muted" label="Khách hàng" />;
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.userInfo}>
            <Text style={styles.fullName}>{item.fullName}</Text>
            <Text style={styles.email}>{item.email}</Text>
            {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
            <Text style={styles.createdAt}>Tham gia: {formatDateTime(item.createdAt)}</Text>
          </View>
          <View style={styles.badgeColumn}>
            {renderRoleBadge(item.role)}
            <View style={{ marginTop: 6 }}>
              {item.isActive ? (
                <Badge variant="success" label="Hoạt động" />
              ) : (
                <Badge variant="danger" label="Đã khoá" />
              )}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBottom}>
          <Button
            label={item.isActive ? 'Khoá tài khoản' : 'Kích hoạt lại'}
            variant={item.isActive ? 'outline' : 'primary'}
            icon={item.isActive ? 'lock-closed-outline' : 'lock-open-outline'}
            loading={toggleActiveMutation.isPending && toggleActiveMutation.variables === item.id}
            onPress={() => handleToggle(item)}
            style={item.isActive ? { borderColor: colors.danger } : {}}
            textStyle={item.isActive ? { color: colors.danger } : {}}
          />
        </View>
      </Card>
    );
  };

  const users = usersData?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          placeholder="Tìm theo tên, email, số điện thoại..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filters */}
      <View style={styles.filterScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLE_FILTERS}
          keyExtractor={(item) => item.label}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = selectedRole === item.value;
            return (
              <TouchableOpacity
                onPress={() => setSelectedRole(item.value)}
                style={[styles.filterChip, isSelected && styles.activeFilterChip]}
              >
                <Text style={[styles.filterText, isSelected && styles.activeFilterText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải danh sách người dùng..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
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
              title="Không tìm thấy người dùng"
              message="Thử thay đổi từ khoá tìm kiếm hoặc bộ lọc vai trò."
              actionLabel="Làm mới"
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  clearBtn: {
    padding: 4,
  },
  filterScroll: {
    height: 44,
    marginBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeFilterText: {
    color: colors.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 12,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  createdAt: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  badgeColumn: {
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  cardBottom: {
    alignItems: 'flex-end',
  },
});

