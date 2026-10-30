import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../../services/useUser';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
import { Address } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressManagement'>;

export const AddressManagementScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const { coords } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');

  // 1. Lấy danh sách địa chỉ chuẩn qua hook useAddresses (được đồng bộ cache queryKeys.user.addresses)
  const { data: addresses, isLoading } = useAddresses();
  const setDefaultMutation = useSetDefaultAddress();
  const deleteMutation = useDeleteAddress();

  const selectedAddressId = useDeliveryAddressStore((s) => s.selectedAddressId);
  const setSelectedAddressId = useDeliveryAddressStore((s) => s.setSelectedAddressId);

  // Địa chỉ đang chọn hiệu lực: nếu có selectedAddressId hợp lệ thì dùng, nếu không thì dùng isDefault
  const activeSelectedId =
    selectedAddressId && addresses?.some((a) => a.id === selectedAddressId)
      ? selectedAddressId
      : addresses?.find((a) => a.isDefault)?.id || addresses?.[0]?.id || null;

  const handleSelectAddress = async (addr: Address) => {
    await setSelectedAddressId(addr.id);
    navigation.goBack();
  };

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

  const filteredAddresses = (addresses || []).filter(
    (a) =>
      a.addressLine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header ShopeeFood Style */}
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
          placeholder="Tìm kiếm địa chỉ đã lưu..."
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
          {/* Nhóm shortcut ShopeeFood: Thêm nhanh Nhà / Công ty */}
          <Text style={styles.sectionHeading}>Thêm nhanh địa chỉ</Text>
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

          {/* Danh sách địa chỉ đã lưu */}
          <Text style={styles.sectionHeading}>Địa chỉ của bạn (Chạm để chọn giao đến)</Text>
          {filteredAddresses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="location-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>Chưa có địa chỉ nào phù hợp</Text>
            </Card>
          ) : (
            filteredAddresses.map((addr) => {
              const isSelected = addr.id === activeSelectedId;
              return (
                <TouchableOpacity
                  key={addr.id}
                  activeOpacity={0.8}
                  onPress={() => handleSelectAddress(addr)}
                >
                  <Card style={[styles.addressCard, isSelected && styles.addressCardSelected]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.labelRow}>
                        <View style={[styles.tagBadge, isSelected && styles.tagBadgeSelected]}>
                          <Text style={[styles.tagBadgeText, isSelected && styles.tagBadgeTextSelected]}>
                            {addr.label}
                          </Text>
                        </View>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Mặc định</Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#EE4D2D" />
                            <Text style={styles.selectedBadgeText}>Đang chọn</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionsRow}>
                        {!addr.isDefault && (
                          <TouchableOpacity
                            onPress={() => setDefaultMutation.mutate(addr.id)}
                            style={styles.actionBtn}
                          >
                            <Text style={styles.setDefaultText}>Đặt mặc định</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteAddress(addr.id, addr.label)}
                          style={styles.actionIconBtn}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.addressLineText} numberOfLines={2}>
                      {addr.addressLine}
                    </Text>

                    <Text style={styles.contactInfoText}>
                      {user?.fullName || 'Khách hàng'} {user?.phone ? `• ${user.phone}` : ''}
                    </Text>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Nút cam nổi bật phía dưới: Thêm địa chỉ mới */}
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
    borderBottomColor: '#EAEAEA',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  savedGroupCard: {
    padding: 0,
    borderRadius: 10,
    overflow: 'hidden',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quickAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 10,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  addressCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  addressCardSelected: {
    borderColor: '#EE4D2D',
    backgroundColor: '#FFFBF9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagBadgeSelected: {
    backgroundColor: '#FEE2E2',
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tagBadgeTextSelected: {
    color: '#EE4D2D',
  },
  defaultBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedBadgeText: {
    fontSize: 11,
    color: '#EE4D2D',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  setDefaultText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  actionIconBtn: {
    padding: 4,
  },
  addressLineText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  contactInfoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
  },
  addAddressBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 8,
  },
});
