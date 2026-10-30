import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../api/users';
import { Button, Text, TopBar } from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useLocation } from '../../hooks/useLocation';
import {
  AddressTag,
  isCoordinateAddressString,
  useAddressDraftStore,
} from '../../store/useAddressDraftStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
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
    if (!receiverPhone && user?.phone) {
      setReceiverPhone(user.phone);
    }
    if (initialTag) {
      setSelectedTag(initialTag);
    }
  }, [user]);

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.createAddress(data),
    onSuccess: (newAddr: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses });
      if (newAddr?.id) {
        useDeliveryAddressStore.getState().setSelectedAddressId(newAddr.id);
      }
      resetDraft();
      Alert.alert('Thành công', 'Đã lưu địa chỉ giao hàng mới!');
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể lưu địa chỉ mới.');
    },
  });

  const handleOpenMapPicker = () => {
    // Kết quả chọn trên bản đồ được ghi thẳng vào useAddressDraftStore mà màn này đang đọc
    navigation.navigate('AddressPicker', { initialCoords: pickedCoords || coords || undefined });
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
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      <TopBar title="Thêm địa chỉ mới" onLeadingPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView
          style={{ flex: 1 }}
          className="flex-1"
          contentContainerClassName="px-4 py-4 gap-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card 1: Người nhận */}
          <View className="rounded-xl border border-line bg-surface p-4 shadow-card gap-3">
            <View className="flex-row items-center justify-between">
              <TextInput
                placeholder="Tên người nhận *"
                placeholderTextColor="#9A9EA5"
                value={receiverName}
                onChangeText={setReceiverName}
                className="flex-1 font-body text-body text-ink"
              />
              <Ionicons name="person-circle-outline" size={26} color="#1EB9CE" />
            </View>

            <View className="h-[1px] bg-line" />

            <TextInput
              placeholder="Số điện thoại *"
              placeholderTextColor="#9A9EA5"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
              className="font-body text-body text-ink"
            />
          </View>

          {/* Card 2: Chọn địa chỉ từ bản đồ */}
          <View className="rounded-xl border border-line bg-surface p-4 shadow-card gap-3">
            <Pressable
              className="flex-row items-center justify-between active:opacity-70"
              onPress={handleOpenMapPicker}
            >
              <View className="flex-1 flex-row items-start mr-2">
                <Ionicons
                  name="location-outline"
                  size={22}
                  color="#1EB9CE"
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <View className="flex-1">
                  <Text
                    variant="body"
                    weight={selectedAddressLine ? 'medium' : 'regular'}
                    tone={selectedAddressLine ? 'default' : 'muted'}
                    numberOfLines={2}
                  >
                    {selectedAddressLine || 'Chọn địa chỉ trên bản đồ *'}
                  </Text>
                  {Boolean(selectedAddressLine) && isCoordinateAddressString(selectedAddressLine) && (
                    <Text variant="caption" tone="danger" className="mt-1">
                      Địa chỉ đang là toạ độ thô, vui lòng bấm để chọn vị trí có tên đường.
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9A9EA5" />
            </Pressable>

            <View className="h-[1px] bg-line" />

            <View className="flex-row items-center justify-between">
              <TextInput
                placeholder="Hoặc tự gõ địa chỉ chữ (Số nhà, đường, phường...)"
                placeholderTextColor="#9A9EA5"
                value={selectedAddressLine}
                onChangeText={(txt) => setManualAddressLine(txt)}
                className="flex-1 font-body text-body text-ink"
              />
              {isManual && (
                <View className="rounded bg-brand-100 px-2 py-0.5">
                  <Text variant="micro" weight="bold" tone="brand">
                    Tự nhập
                  </Text>
                </View>
              )}
            </View>

            {isManual && (
              <View className="mt-1 flex-row items-center justify-between">
                <Text
                  variant="caption"
                  weight="medium"
                  tone={isPinConfirmed ? 'success' : 'warning'}
                >
                  {isPinConfirmed
                    ? `Đã ghim toạ độ (${pickedCoords?.latitude.toFixed(4)}, ${pickedCoords?.longitude.toFixed(4)})`
                    : 'Chưa xác nhận vị trí ghim giao hàng'}
                </Text>
                {!isPinConfirmed && coords && (
                  <Pressable
                    onPress={() => confirmPin(coords)}
                    className="rounded bg-warning-soft px-2.5 py-1 active:opacity-75"
                  >
                    <Text variant="micro" weight="bold" tone="warning">
                      Xác nhận toạ độ này
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            <View className="h-[1px] bg-line" />

            <TextInput
              placeholder="Tòa nhà, Số tầng (Không bắt buộc)"
              placeholderTextColor="#9A9EA5"
              value={buildingFloor}
              onChangeText={setBuildingFloor}
              className="font-body text-body text-ink"
            />

            <View className="h-[1px] bg-line" />

            <TextInput
              placeholder="Cổng (không bắt buộc)"
              placeholderTextColor="#9A9EA5"
              value={gateInfo}
              onChangeText={setGateInfo}
              className="font-body text-body text-ink"
            />
          </View>

          {/* Card 3: Thẻ nhãn địa chỉ */}
          <View className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <Text variant="caption" weight="bold" tone="secondary" className="mb-2 uppercase">
              Loại địa chỉ
            </Text>
            <View className="flex-row gap-2.5">
              {(['Nhà', 'Công ty', 'Khác'] as AddressTag[]).map((tag) => {
                const isActive = selectedTag === tag;
                return (
                  <Pressable
                    key={tag}
                    className={`rounded-full border px-4 py-2 active:opacity-75 ${
                      isActive
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-line bg-canvas-subtle'
                    }`}
                    onPress={() => setSelectedTag(tag)}
                  >
                    <Text
                      variant="caption"
                      weight="bold"
                      tone={isActive ? 'brand' : 'secondary'}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Card 4: Ghi chú cho tài xế */}
          <View className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <TextInput
              placeholder="Ghi chú cho Tài xế (không bắt buộc)"
              placeholderTextColor="#9A9EA5"
              value={driverNote}
              onChangeText={setDriverNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[90px] font-body text-body text-ink"
            />
          </View>
        </ScrollView>

        {/* Thanh cảnh báo mục còn thiếu & Nút Lưu */}
        <View className="border-t border-line bg-surface p-4 shadow-card gap-2.5">
          {!canSave && (
            <View className="flex-row items-center gap-1.5 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
              <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
              <Text variant="caption" weight="medium" tone="warning" numberOfLines={2} className="flex-1">
                Còn thiếu: {missingFields.join(' • ')}
              </Text>
            </View>
          )}

          <Button
            label={createMutation.isPending ? 'Đang lưu...' : 'Lưu địa chỉ'}
            onPress={handleSave}
            loading={createMutation.isPending}
            variant="primary"
            size="lg"
            disabled={!canSave}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
