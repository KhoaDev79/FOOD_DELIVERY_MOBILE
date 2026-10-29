import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from '../../components/common/Card';
import { colors } from '../../constants/colors';
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
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn mã giảm giá</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Input tìm kiếm voucher */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          placeholder="Nhập hoặc tìm kiếm mã voucher..."
          placeholderTextColor={colors.textMuted}
          value={searchInput}
          onChangeText={setSearchInput}
          style={styles.input}
        />
      </View>

      <FlatList
        data={filteredVouchers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedId === item.id;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedId(isSelected ? undefined : item.id)}
            >
              <Card style={[styles.voucherCard, isSelected && styles.voucherCardSelected]}>
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon} size={22} color="#EE4D2D" />
                </View>

                <View style={styles.voucherInfo}>
                  <View style={styles.codeRow}>
                    <Text style={styles.codeBadge}>{item.code}</Text>
                  </View>
                  <Text style={styles.voucherTitle}>{item.title}</Text>
                  <Text style={styles.voucherDesc}>{item.description}</Text>
                </View>

                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSelected ? '#EE4D2D' : colors.textMuted}
                />
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      {/* Nút áp dụng */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
          <Text style={styles.applyBtnText}>Áp dụng ưu đãi</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    margin: 14,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 14, color: colors.text },
  listContent: { paddingHorizontal: 14, paddingBottom: 20 },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    gap: 12,
  },
  voucherCardSelected: {
    borderColor: '#EE4D2D',
    borderWidth: 1.5,
    backgroundColor: '#FFFBF9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherInfo: { flex: 1 },
  codeRow: { marginBottom: 3 },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0ED',
    color: '#EE4D2D',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  voucherTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  voucherDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  applyBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

