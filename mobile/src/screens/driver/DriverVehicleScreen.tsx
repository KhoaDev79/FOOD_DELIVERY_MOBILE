import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
import {
  Button,
  ConfirmDialog,
  Input,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { FilterChip } from '../../components/ui/Chip';
import { VehicleType } from '../../types/api';

interface Props {
  navigation: any;
}

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: any }[] = [
  { type: 'MOTORBIKE', label: 'Xe máy', icon: 'bicycle' },
  { type: 'ELECTRIC_MOTORBIKE', label: 'Xe máy điện', icon: 'flash' },
  { type: 'BICYCLE', label: 'Xe đạp', icon: 'walk' },
];

const VN_PLATE_REGEX = /^[0-9]{2}[- ]?[A-ZĐ]{1,2}[0-9]?[- ](?:[0-9]{4,5}|[0-9]{3}\.[0-9]{2})$/i;

export const DriverVehicleScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: () => driversApi.getMe(),
  });

  const [form, setForm] = useState<{
    vehicleType?: VehicleType;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licensePlate?: string;
    driverLicenseClass?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  }>({});

  const vehicleType = form.vehicleType ?? profile?.vehicleType ?? 'MOTORBIKE';
  const vehicleBrand = form.vehicleBrand ?? profile?.vehicleBrand ?? '';
  const vehicleModel = form.vehicleModel ?? profile?.vehicleModel ?? '';
  const vehicleColor = form.vehicleColor ?? profile?.vehicleColor ?? '';
  const licensePlate = form.licensePlate ?? profile?.licensePlate ?? '';
  const driverLicenseClass = form.driverLicenseClass ?? profile?.driverLicenseClass ?? 'A1';
  const emergencyContactName = form.emergencyContactName ?? profile?.emergencyContactName ?? '';
  const emergencyContactPhone = form.emergencyContactPhone ?? profile?.emergencyContactPhone ?? '';
  const bankName = form.bankName ?? profile?.bankName ?? '';
  const bankAccountNumber = form.bankAccountNumber ?? profile?.bankAccountNumber ?? '';
  const bankAccountName = form.bankAccountName ?? profile?.bankAccountName ?? '';

  const [plateError, setPlateError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => driversApi.updateVehicle(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['driver', 'me'], updated);
      queryClient.invalidateQueries({ queryKey: ['driver', 'me'] });
      toast('Đã cập nhật thông tin phương tiện thành công!', 'success');
      navigation.goBack();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin';
      toast(msg, 'error');
    },
  });

  const handlePlateChange = (val: string) => {
    const upper = val.toUpperCase();
    setForm((prev) => ({ ...prev, licensePlate: upper }));
    if (vehicleType !== 'BICYCLE' && upper.trim().length > 0) {
      if (!VN_PLATE_REGEX.test(upper.trim())) {
        setPlateError('Định dạng biển số chưa đúng (ví dụ: 59-X1 123.45 hoặc 29-H1 888.88)');
      } else {
        setPlateError(null);
      }
    } else {
      setPlateError(null);
    }
  };

  const handleSave = () => {
    if (vehicleType !== 'BICYCLE') {
      const cleanPlate = licensePlate.trim();
      if (!cleanPlate) {
        setPlateError('Vui lòng nhập biển số xe của bạn');
        return;
      }
      if (!VN_PLATE_REGEX.test(cleanPlate)) {
        setPlateError('Định dạng biển số chưa đúng (ví dụ: 59-X1 123.45 hoặc 29-H1 888.88)');
        return;
      }
    }

    // Nếu đổi biển số hoặc loại xe, cảnh báo bằng ConfirmDialog
    const isCritical =
      profile &&
      (vehicleType !== profile.vehicleType ||
        licensePlate.trim().toUpperCase() !== (profile.licensePlate || '').toUpperCase());

    if (isCritical) {
      setShowConfirmDialog(true);
    } else {
      submitUpdate();
    }
  };

  const submitUpdate = () => {
    setShowConfirmDialog(false);
    updateMutation.mutate({
      vehicleType,
      vehicleBrand: vehicleBrand.trim() || undefined,
      vehicleModel: vehicleModel.trim() || undefined,
      vehicleColor: vehicleColor.trim() || undefined,
      licensePlate: vehicleType === 'BICYCLE' ? undefined : licensePlate.trim().toUpperCase(),
      driverLicenseClass: vehicleType === 'BICYCLE' ? undefined : driverLicenseClass.trim(),
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      bankName: bankName.trim() || undefined,
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      bankAccountName: bankAccountName.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-surface">
        <TopBar title="Thông tin phương tiện" onLeadingPress={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1EB9CE" />
          <Text variant="body" tone="secondary" className="mt-3">
            Đang tải dữ liệu hồ sơ...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <TopBar title="Cập nhật phương tiện" onLeadingPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* CẢNH BÁO QUY ĐỊNH DUYỆT */}
          <View className="mb-4 flex-row items-start gap-3 rounded-2xl border border-warning-soft bg-warning-soft/20 p-4">
            <Ionicons name="information-circle" size={22} color="#EAB308" />
            <View className="flex-1">
              <Text variant="caption" weight="bold" tone="warning">
                Lưu ý quan trọng khi thay đổi thông tin:
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1">
                Nếu bạn thay đổi Loại xe hoặc Biển số xe, hệ thống sẽ tự động chuyển hồ sơ về trạng
                thái CHỜ DUYỆT và chuyển ngoại tuyến để ban quản trị xác minh lại.
              </Text>
            </View>
          </View>

          {/* CHỌN LOẠI PHƯƠNG TIỆN */}
          <View className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Text variant="headline" weight="bold" className="mb-3">
              Loại phương tiện
            </Text>
            <View className="flex-row items-center gap-2">
              {VEHICLE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.type}
                  label={opt.label}
                  selected={vehicleType === opt.type}
                  onPress={() => setForm((prev) => ({ ...prev, vehicleType: opt.type }))}
                />
              ))}
            </View>
          </View>

          {/* THÔNG TIN CHI TIẾT XE */}
          <View className="mb-4 gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Text variant="headline" weight="bold">
              Chi tiết phương tiện
            </Text>

            {vehicleType !== 'BICYCLE' && (
              <View>
                <Input
                  label="Biển số xe *"
                  placeholder="Ví dụ: 59-X1 123.45"
                  value={licensePlate}
                  onChangeText={handlePlateChange}
                  autoCapitalize="characters"
                  error={plateError || undefined}
                />
              </View>
            )}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Hãng xe"
                  placeholder="Honda, Yamaha..."
                  value={vehicleBrand}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, vehicleBrand: v }))}
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Dòng xe"
                  placeholder="Wave Alpha, Vision..."
                  value={vehicleModel}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, vehicleModel: v }))}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Màu sơn xe"
                  placeholder="Đỏ đen, Trắng..."
                  value={vehicleColor}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, vehicleColor: v }))}
                />
              </View>
              {vehicleType !== 'BICYCLE' && (
                <View className="flex-1">
                  <Input
                    label="Hạng GPLX"
                    placeholder="A1, A..."
                    value={driverLicenseClass}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, driverLicenseClass: v }))}
                  />
                </View>
              )}
            </View>
          </View>

          {/* LIÊN HỆ KHẨN CẤP */}
          <View className="mb-4 gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Text variant="headline" weight="bold">
              Người liên hệ khẩn cấp
            </Text>

            <Input
              label="Họ tên người thân"
              placeholder="Ví dụ: Nguyễn Văn A"
              value={emergencyContactName}
              onChangeText={(v) => setForm((prev) => ({ ...prev, emergencyContactName: v }))}
            />

            <Input
              label="Số điện thoại người thân"
              placeholder="Ví dụ: 0912345678"
              keyboardType="phone-pad"
              value={emergencyContactPhone}
              onChangeText={(v) => setForm((prev) => ({ ...prev, emergencyContactPhone: v }))}
            />
          </View>

          {/* TÀI KHOẢN NGÂN HÀNG (NHẬN DOANH THU) */}
          <View className="mb-4 gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Text variant="headline" weight="bold">
              Tài khoản nhận doanh thu
            </Text>

            <Input
              label="Ngân hàng"
              placeholder="Vietcombank, MBBank..."
              value={bankName}
              onChangeText={(v) => setForm((prev) => ({ ...prev, bankName: v }))}
            />

            <Input
              label="Số tài khoản ngân hàng"
              placeholder="Nhập số tài khoản"
              keyboardType="number-pad"
              value={bankAccountNumber}
              onChangeText={(v) => setForm((prev) => ({ ...prev, bankAccountNumber: v }))}
            />

            <Input
              label="Tên chủ tài khoản"
              placeholder="NGUYEN VAN A"
              autoCapitalize="characters"
              value={bankAccountName}
              onChangeText={(t) => setForm((prev) => ({ ...prev, bankAccountName: t.toUpperCase() }))}
            />
          </View>

          {/* NÚT LƯU */}
          <View className="mt-2">
            <Button
              label="Lưu thông tin phương tiện"
              variant="primary"
              size="lg"
              loading={updateMutation.isPending}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* HỘP XÁC NHẬN NẾU ĐỔI THÔNG TIN QUAN TRỌNG */}
      <ConfirmDialog
        visible={showConfirmDialog}
        title="Xác nhận duyệt lại hồ sơ"
        message="Bạn vừa thay đổi Biển số xe hoặc Loại phương tiện. Hồ sơ của bạn sẽ chuyển về trạng thái CHỜ DUYỆT và tự chuyển ngoại tuyến cho đến khi được ban quản trị xét duyệt lại. Bạn có chắc chắn muốn lưu không?"
        confirmLabel="Đồng ý lưu"
        cancelLabel="Kiểm tra lại"
        loading={updateMutation.isPending}
        onConfirm={submitUpdate}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </SafeAreaView>
  );
};
