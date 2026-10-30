import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, TopBar } from '../../components/ui';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherSelect'>;

export interface VoucherItem {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'shipping';
  discountAmount: number; // e.g. 10 (%) or 15000 (VND)
  minOrder: number;
  icon: keyof typeof Ionicons.glyphMap;
}

export const AVAILABLE_VOUCHERS: VoucherItem[] = [
  {
    id: 'v1',
    code: 'FREESHIP15K',
    title: 'Miễn phí vận chuyển 15.000đ',
    description: 'Áp dụng cho mọi đơn hàng từ 50.000đ',
    discountType: 'shipping',
    discountAmount: 15000,
    minOrder: 50000,
    icon: 'bicycle',
  },
  {
    id: 'v2',
    code: 'GIAM10PT',
    title: 'Giảm 10% tổng đơn hàng',
    description: 'Giảm tối đa 30.000đ cho đơn từ 80.000đ',
    discountType: 'percentage',
    discountAmount: 10,
    minOrder: 80000,
    icon: 'pricetag',
  },
  {
    id: 'v3',
    code: 'VNPAYDEAL',
    title: 'Giảm 20.000đ thanh toán VNPay',
    description: 'Áp dụng khi chọn thanh toán qua VNPay',
    discountType: 'fixed',
    discountAmount: 20000,
    minOrder: 70000,
    icon: 'card',
  },
  {
    id: 'v4',
    code: 'BIGDEAL30K',
    title: 'Giảm 30.000đ cho đơn từ 120.000đ',
    description: 'Ưu đãi đặc biệt cho bữa ăn no nê',
    discountType: 'fixed',
    discountAmount: 30000,
    minOrder: 120000,
    icon: 'flame',
  },
];

export const VoucherSelectScreen: React.FC<Props> = ({ navigation, route }) => {
  const currentVoucherId = route.params?.selectedVoucherId;
  const [selectedId, setSelectedId] = useState<string | undefined>(currentVoucherId);
  const [searchInput, setSearchInput] = useState('');

  const filteredVouchers = AVAILABLE_VOUCHERS.filter(
    (v) =>
      v.code.toLowerCase().includes(searchInput.toLowerCase()) ||
      v.title.toLowerCase().includes(searchInput.toLowerCase()),
  );

  const handleApply = () => {
    const voucher = AVAILABLE_VOUCHERS.find((v) => v.id === selectedId);
    if (route.params?.onSelectVoucher) {
      route.params.onSelectVoucher(voucher || null);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      <TopBar title="Chọn mã giảm giá" onLeadingPress={() => navigation.goBack()} />

      {/* Input tìm kiếm voucher */}
      <View className="px-4 py-2.5">
        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-line bg-canvas-subtle px-3.5">
          <Ionicons name="search" size={18} color="#9A9EA5" />
          <TextInput
            placeholder="Nhập hoặc tìm kiếm mã voucher..."
            placeholderTextColor="#9A9EA5"
            value={searchInput}
            onChangeText={setSearchInput}
            className="h-full flex-1 font-body text-body text-ink"
          />
        </View>
      </View>

      <FlatList
        data={filteredVouchers}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-2 gap-3"
        renderItem={({ item }) => {
          const isSelected = selectedId === item.id;
          return (
            <Pressable
              className={`flex-row items-center rounded-xl border bg-surface p-3.5 shadow-card active:opacity-85 ${
                isSelected ? 'border-brand-500 bg-brand-50/40' : 'border-line'
              }`}
              onPress={() => setSelectedId(isSelected ? undefined : item.id)}
            >
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-lg bg-brand-50">
                <Ionicons name={item.icon} size={22} color="#1EB9CE" />
              </View>

              <View className="flex-1 pr-2">
                <View className="self-start rounded bg-brand-100 px-2 py-0.5 mb-1">
                  <Text variant="micro" weight="bold" tone="brand">
                    {item.code}
                  </Text>
                </View>
                <Text variant="body" weight="bold">
                  {item.title}
                </Text>
                <Text variant="caption" tone="secondary" className="mt-0.5">
                  {item.description}
                </Text>
              </View>

              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={isSelected ? '#1EB9CE' : '#9A9EA5'}
              />
            </Pressable>
          );
        }}
      />

      {/* Nút áp dụng */}
      <View className="border-t border-line bg-surface p-4 shadow-card">
        <Button
          label="Áp dụng ưu đãi"
          onPress={handleApply}
          variant="primary"
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};
