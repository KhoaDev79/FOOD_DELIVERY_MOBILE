import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usersApi } from '../../api/users';
import { colors } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import {
  AddressTag,
  isCoordinateAddressString,
  useAddressDraftStore,
} from '../../store/useAddressDraftStore';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddAddress'>;

export const AddAddressScreen: React.FC<Props> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { coords } = useLocation();

  const initialTag: AddressTag = route.params?.initialTag || 'Nhà';

  const {
    receiverName,
    receiverPhone,
    selectedAddressLine,
    pickedCoords,
    buildingFloor,
    gateInfo,
    selectedTag,
    driverNote,
    isManual,
    isPinConfirmed,
    setReceiverName,
    setReceiverPhone,
    setSelectedAddress,
    confirmPin,
    setManualAddressLine,
    setBuildingFloor,
    setGateInfo,
    setSelectedTag,
    setDriverNote,
    resetDraft,
    getMissingFields,
  } = useAddressDraftStore();

  // Dọn sạch bản nháp khi rời màn hình hoàn toàn (huỷ / back / swipe)
  useEffect(() => {
    return () => {
      resetDraft();
    };
  }, []);

  // Khởi tạo các giá trị mặc định từ tài khoản người dùng
  useEffect(() => {
    if (!receiverName && user?.fullName) {
      setReceiverName(user.fullName);
    }
    if (!receiverPhone && (user?.phone || '0387466222')) {
      setReceiverPhone(user?.phone || '0387466222');
    }
    if (initialTag) {
      setSelectedTag(initialTag);
    }
  }, [user]);

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.createAddress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      resetDraft();
      Alert.alert('Thành công', 'Đã lưu địa chỉ giao hàng mới!');
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể lưu địa chỉ mới.');
    },
  });

  const handleOpenMapPicker = () => {
    navigation.navigate('AddressPicker', {
      initialCoords: pickedCoords || coords,
      onSelectAddress: (data) => {
        setSelectedAddress(data.addressLine, { latitude: data.lat, longitude: data.lng });
      },
    });
  };

  const missingFields = getMissingFields();
  const canSave = missingFields.length === 0;

  const handleSave = () => {
    if (!canSave || !pickedCoords || !isPinConfirmed) {
      Alert.alert(
        'Thông tin chưa đầy đủ',
        `Vui lòng hoàn thành các mục sau trước khi bấm Lưu:\n\n• ${missingFields.join('\n• ')}`,
      );
      return;
    }

    const extraParts: string[] = [];
    if (buildingFloor.trim()) extraParts.push(buildingFloor.trim());
    if (gateInfo.trim()) extraParts.push(`Cổng: ${gateInfo.trim()}`);
    if (driverNote.trim()) extraParts.push(`Ghi chú: ${driverNote.trim()}`);

    const fullDetails =
      extraParts.length > 0
        ? `[${extraParts.join(', ')}] ${selectedAddressLine.trim()}`
        : selectedAddressLine.trim();

    createMutation.mutate({
      label: selectedTag,
      addressLine: fullDetails,
      latitude: pickedCoords.latitude,
      longitude: pickedCoords.longitude,
      isDefault: true,
      isManual: isManual,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header ShopeeFood style */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#EE4D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm địa chỉ mới</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card 1: Người nhận */}
          <View style={styles.card}>
            <View style={styles.inputWithIconRow}>
              <TextInput
                placeholder="Tên người nhận *"
                placeholderTextColor={colors.textMuted}
                value={receiverName}
                onChangeText={setReceiverName}
                style={styles.cardInput}
              />
              <Ionicons name="person-circle-outline" size={26} color="#EE4D2D" />
            </View>

            <View style={styles.divider} />

            <TextInput
              placeholder="Số điện thoại *"
              placeholderTextColor={colors.textMuted}
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
              style={styles.cardInput}
            />
          </View>

          {/* Card 2: Chọn địa chỉ từ bản đồ */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.selectAddressBtn}
              onPress={handleOpenMapPicker}
              activeOpacity={0.7}
            >
              <View style={styles.selectAddressLeft}>
                <Ionicons
                  name="location-outline"
                  size={22}
                  color="#EE4D2D"
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.selectAddressPlaceholder,
                      Boolean(selectedAddressLine) && styles.selectAddressSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {selectedAddressLine || 'Chọn địa chỉ trên bản đồ *'}
                  </Text>
                  {Boolean(selectedAddressLine) && isCoordinateAddressString(selectedAddressLine) && (
                    <Text style={styles.errorText}>
                      ⚠️ Địa chỉ đang là toạ độ thô, vui lòng bấm để chọn vị trí có tên đường.
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.inputWithIconRow}>
              <TextInput
                placeholder="Hoặc tự gõ địa chỉ chữ (Số nhà, đường, phường...)"
                placeholderTextColor={colors.textMuted}
                value={selectedAddressLine}
                onChangeText={(txt) => setManualAddressLine(txt)}
                style={styles.cardInput}
              />
              {isManual && (
                <View style={styles.manualPill}>
                  <Text style={styles.manualPillText}>Tự nhập</Text>
                </View>
              )}
            </View>

            {isManual && (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: isPinConfirmed ? '#2E7D32' : '#E65100', fontWeight: '500' }}>
                  {isPinConfirmed
                    ? `✓ Đã ghim toạ độ (${pickedCoords?.latitude.toFixed(4)}, ${pickedCoords?.longitude.toFixed(4)})`
                    : '⚠ Chưa xác nhận vị trí ghim giao hàng'}
                </Text>
                {!isPinConfirmed && (
                  <TouchableOpacity
                    onPress={() => confirmPin(coords)}
                    style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                  >
                    <Text style={{ fontSize: 12, color: '#E65100', fontWeight: '600' }}>Xác nhận toạ độ này</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.divider} />

            <TextInput
              placeholder="Tòa nhà, Số tầng (Không bắt buộc)"
              placeholderTextColor={colors.textMuted}
              value={buildingFloor}
              onChangeText={setBuildingFloor}
              style={styles.cardInput}
            />

            <View style={styles.divider} />

            <TextInput
              placeholder="Cổng (không bắt buộc)"
              placeholderTextColor={colors.textMuted}
              value={gateInfo}
              onChangeText={setGateInfo}
              style={styles.cardInput}
            />
          </View>

          {/* Card 3: Thẻ nhãn địa chỉ: [Nhà] [Công ty] [Khác] */}
          <View style={styles.card}>
            <View style={styles.tagsContainer}>
              {(['Nhà', 'Công ty', 'Khác'] as AddressTag[]).map((tag) => {
                const isActive = selectedTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagButton, isActive && styles.tagButtonActive]}
                    onPress={() => setSelectedTag(tag)}
                  >
                    <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Card 4: Ghi chú cho tài xế */}
          <View style={[styles.card, styles.noteCard]}>
            <TextInput
              placeholder="Ghi chú cho Tài xế (không bắt buộc)"
              placeholderTextColor={colors.textMuted}
              value={driverNote}
              onChangeText={setDriverNote}
              multiline
              numberOfLines={4}
              style={styles.noteInput}
            />
          </View>
        </ScrollView>

        {/* Thanh cảnh báo mục còn thiếu & Nút cam Lưu phía dưới cùng */}
        <View style={styles.bottomBar}>
          {!canSave && (
            <View style={styles.missingBadge}>
              <Ionicons name="alert-circle-outline" size={16} color="#C2410C" />
              <Text style={styles.missingBadgeText} numberOfLines={2}>
                Còn thiếu: {missingFields.join(' • ')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={createMutation.isPending}
            activeOpacity={canSave ? 0.8 : 0.6}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
              {createMutation.isPending ? 'Đang lưu...' : 'Lưu địa chỉ'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 14,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  selectAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  selectAddressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  selectAddressPlaceholder: {
    fontSize: 15,
    color: colors.textMuted,
  },
  selectAddressSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  tagButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagButtonActive: {
    backgroundColor: '#FFF2EE',
    borderColor: '#EE4D2D',
  },
  tagText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  tagTextActive: {
    color: '#EE4D2D',
    fontWeight: '700',
  },
  noteCard: {
    paddingVertical: 10,
  },
  noteInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  bottomBar: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  manualPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manualPillText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  missingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  missingBadgeText: {
    fontSize: 12,
    color: '#C2410C',
    fontWeight: '600',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtnTextDisabled: {
    color: '#64748B',
  },
});
