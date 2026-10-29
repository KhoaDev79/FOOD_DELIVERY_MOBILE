import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usersApi } from '../../api/users';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import { useAuthStore } from '../../store/useAuthStore';
import { Address } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressManagement'>;

export const AddressManagementScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { coords } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');

  // Lấy danh sách địa chỉ đã lưu
  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.getAddresses(),
  });

  // Đặt làm địa chỉ giao hàng mặc định
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => usersApi.setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      Alert.alert('Thành công', 'Đã chọn làm địa chỉ giao hàng mặc định!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể đổi địa chỉ mặc định.');
    },
  });

  // Xoá địa chỉ
  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xoá địa chỉ.');
    },
  });

  const handleDeleteAddress = (id: string, label: string) => {
    Alert.alert('Xoá địa chỉ', `Bạn có chắc muốn xoá địa chỉ "${label}" này không?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const defaultAddress = addresses?.find((a) => a.isDefault) || addresses?.[0];
  const otherAddresses = (addresses || [])
    .filter((a) => a.id !== defaultAddress?.id)
    .filter(
      (a) =>
        a.addressLine.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header ShopeeFood Style (Ảnh 2) */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#EE4D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Địa chỉ giao hàng</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddressPicker', { initialCoords: coords })}
          style={styles.headerBtn}
        >
          <Ionicons name="map-outline" size={24} color="#EE4D2D" />
        </TouchableOpacity>
      </View>

      {/* Thanh tìm kiếm vị trí */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          placeholder="Tìm vị trí"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <LoadingSpinner message="Đang tải danh sách địa chỉ..." />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Địa chỉ hiện tại / đang chọn (Ảnh 2) */}
          {defaultAddress && (
            <Card style={styles.selectedAddressCard}>
              <View style={styles.selectedRow}>
                <Ionicons name="location-sharp" size={24} color="#EE4D2D" style={styles.pinIcon} />
                <View style={styles.addressInfoCol}>
                  <View style={styles.titleRow}>
                    <Text style={styles.mainAddressText} numberOfLines={1}>
                      {defaultAddress.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('AddAddress', { initialTag: defaultAddress.label as any })}
                    >
                      <Text style={styles.editLink}>Sửa</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.fullAddressText} numberOfLines={2}>
                    {defaultAddress.addressLine}
                  </Text>
                  <Text style={styles.userContactText}>
                    {user?.fullName || 'Khách hàng'} {user?.phone ? `(${user.phone})` : ''}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Nhóm shortcut ShopeeFood: Địa chỉ đã lưu */}
          <Text style={styles.sectionHeading}>Địa chỉ đã lưu</Text>
          <Card style={styles.savedGroupCard}>
            <TouchableOpacity
              style={styles.quickAddRow}
              onPress={() => navigation.navigate('AddAddress', { initialTag: 'Nhà' })}
            >
              <View style={styles.quickAddLeft}>
                <Ionicons name="home-outline" size={20} color={colors.text} />
                <Text style={styles.quickAddText}>Thêm địa chỉ Nhà</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.innerDivider} />

            <TouchableOpacity
              style={styles.quickAddRow}
              onPress={() => navigation.navigate('AddAddress', { initialTag: 'Công ty' })}
            >
              <View style={styles.quickAddLeft}>
                <Ionicons name="briefcase-outline" size={20} color={colors.text} />
                <Text style={styles.quickAddText}>Thêm địa chỉ Công ty</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </Card>

          {/* Danh sách các địa chỉ khác - Chạm để chọn làm địa chỉ giao hàng */}
          {otherAddresses.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.sectionHeading}>Địa chỉ khác (Chạm để chọn giao hàng)</Text>
              {otherAddresses.map((addr: Address) => (
                <TouchableOpacity
                  key={addr.id}
                  activeOpacity={0.7}
                  onPress={() => setDefaultMutation.mutate(addr.id)}
                >
                  <Card style={styles.otherAddressCard}>
                    <View style={styles.otherRow}>
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{addr.label}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteAddress(addr.id, addr.label)}
                        style={styles.deleteIcon}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.otherAddressLine}>{addr.addressLine}</Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Nút cam nổi bật phía dưới: Thêm địa chỉ mới (Ảnh 2) */}
      <View style={styles.bottomBar}>
        <Button
          title="Thêm địa chỉ mới"
          onPress={() => navigation.navigate('AddAddress')}
          style={styles.addAddressBtn}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  selectedAddressCard: {
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EE4D2D',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pinIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  addressInfoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mainAddressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  editLink: {
    fontSize: 14,
    color: '#0088FF',
    fontWeight: '600',
    marginLeft: 8,
  },
  fullAddressText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  userContactText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  savedGroupCard: {
    padding: 0,
    borderRadius: 10,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickAddText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 48,
  },
  otherAddressCard: {
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 10,
    marginBottom: 10,
  },
  otherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteIcon: {
    padding: 4,
  },
  otherAddressLine: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  addAddressBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 8,
    paddingVertical: 14,
  },
});
