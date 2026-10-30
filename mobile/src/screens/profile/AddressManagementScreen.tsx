import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, LoadingSpinner, Text, TopBar } from '../../components/ui';
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
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      <TopBar
        title="Địa chỉ giao hàng"
        onLeadingPress={() => navigation.goBack()}
        trailing={
          <Pressable
            onPress={() => navigation.navigate('AddressPicker', { initialCoords: coords || undefined })}
            className="p-1 active:opacity-70"
          >
            <Ionicons name="map-outline" size={24} color="#1EB9CE" />
          </Pressable>
        }
      />

      {/* Thanh tìm kiếm vị trí */}
      <View className="px-4 py-2.5">
        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-line bg-canvas-subtle px-3.5">
          <Ionicons name="search" size={18} color="#9A9EA5" />
          <TextInput
            placeholder="Tìm kiếm địa chỉ đã lưu..."
            placeholderTextColor="#9A9EA5"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="h-full flex-1 font-body text-body text-ink"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingSpinner message="Đang tải danh sách địa chỉ..." />
      ) : (
        <ScrollView contentContainerClassName="px-4 py-3 gap-5" showsVerticalScrollIndicator={false}>
          {/* Nhóm shortcut: Thêm nhanh Nhà / Công ty */}
          <View className="gap-2">
            <Text variant="caption" weight="bold" tone="secondary" className="px-1 uppercase">
              Thêm nhanh địa chỉ
            </Text>
            <View className="rounded-xl border border-line bg-surface p-1 shadow-card">
              <Pressable
                className="flex-row items-center justify-between p-3 active:bg-canvas-subtle rounded-lg"
                onPress={() => navigation.navigate('AddAddress', { initialTag: 'Nhà' })}
              >
                <View className="flex-row items-center gap-2.5">
                  <Ionicons name="home-outline" size={20} color="#1A1A1A" />
                  <Text variant="body" weight="medium">
                    Thêm địa chỉ Nhà
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9A9EA5" />
              </Pressable>

              <View className="h-[1px] bg-line mx-3" />

              <Pressable
                className="flex-row items-center justify-between p-3 active:bg-canvas-subtle rounded-lg"
                onPress={() => navigation.navigate('AddAddress', { initialTag: 'Công ty' })}
              >
                <View className="flex-row items-center gap-2.5">
                  <Ionicons name="briefcase-outline" size={20} color="#1A1A1A" />
                  <Text variant="body" weight="medium">
                    Thêm địa chỉ Công ty
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9A9EA5" />
              </Pressable>
            </View>
          </View>

          {/* Danh sách địa chỉ đã lưu */}
          <View className="gap-2.5">
            <Text variant="caption" weight="bold" tone="secondary" className="px-1 uppercase">
              Địa chỉ của bạn (Chạm để chọn giao đến)
            </Text>
            {filteredAddresses.length === 0 ? (
              <View className="items-center justify-center rounded-xl border border-line bg-surface p-8 shadow-card">
                <Ionicons name="location-outline" size={36} color="#9A9EA5" />
                <Text variant="body" tone="muted" className="mt-2 text-center">
                  Chưa có địa chỉ nào phù hợp
                </Text>
              </View>
            ) : (
              filteredAddresses.map((addr) => {
                const isSelected = addr.id === activeSelectedId;
                return (
                  <Pressable
                    key={addr.id}
                    className={`rounded-xl border p-4 shadow-card active:opacity-85 ${
                      isSelected ? 'border-brand-500 bg-brand-50/30' : 'border-line bg-surface'
                    }`}
                    onPress={() => handleSelectAddress(addr)}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <View
                          className={`rounded px-2.5 py-1 ${
                            isSelected ? 'bg-brand-500' : 'bg-canvas-subtle border border-line'
                          }`}
                        >
                          <Text
                            variant="micro"
                            weight="bold"
                            tone={isSelected ? 'inverse' : 'default'}
                          >
                            {addr.label}
                          </Text>
                        </View>
                        {addr.isDefault && (
                          <View className="rounded bg-brand-100 px-2 py-0.5">
                            <Text variant="micro" weight="bold" tone="brand">
                              Mặc định
                            </Text>
                          </View>
                        )}
                        {isSelected && (
                          <View className="flex-row items-center gap-1 rounded bg-success-soft px-2 py-0.5">
                            <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                            <Text variant="micro" weight="bold" tone="success">
                              Đang chọn
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center gap-3">
                        {!addr.isDefault && (
                          <Pressable
                            onPress={() => setDefaultMutation.mutate(addr.id)}
                            className="active:opacity-70"
                          >
                            <Text variant="caption" weight="semibold" tone="brand">
                              Đặt mặc định
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleDeleteAddress(addr.id, addr.label)}
                          className="p-1 active:opacity-70"
                        >
                          <Ionicons name="trash-outline" size={18} color="#E5484D" />
                        </Pressable>
                      </View>
                    </View>

                    <Text variant="body" weight="medium" numberOfLines={2}>
                      {addr.addressLine}
                    </Text>

                    <Text variant="caption" tone="secondary" className="mt-1">
                      {user?.fullName || 'Khách hàng'} {user?.phone ? `• ${user.phone}` : ''}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Nút thêm địa chỉ mới */}
      <View className="border-t border-line bg-surface p-4 shadow-card">
        <Button
          label="Thêm địa chỉ mới"
          onPress={() => navigation.navigate('AddAddress')}
          variant="primary"
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};
