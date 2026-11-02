import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
import { NoticeCard, SectionCard } from '../../components/modules/partner/PartnerKit';
import {
  Button,
  cn,
  ConfirmDialog,
  Icon,
  Input,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { VehicleType } from '../../types/api';
import { palette } from '../../theme';

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
  const insets = useSafeAreaInsets();

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

  // Chỉ để hiển thị cảnh báo: cùng điều kiện với hộp xác nhận khi lưu
  const willNeedReview = Boolean(
    profile &&
      (vehicleType !== profile.vehicleType ||
        licensePlate.trim().toUpperCase() !== (profile.licensePlate || '').toUpperCase()),
  );

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
          <ActivityIndicator size="large" color={palette.brand['500']} />
          <Text variant="body" tone="secondary" className="mt-3">
            Đang tải dữ liệu hồ sơ...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas-subtle">
      <SafeAreaView edges={['top']} className="bg-canvas">
        <TopBar title="Cập nhật phương tiện" onLeadingPress={() => navigation.goBack()} />
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CẢNH BÁO DUYỆT LẠI: chỉ hiện khi đang đổi loại xe hoặc biển số */}
          {willNeedReview && (
            <NoticeCard
              tone="warning"
              icon="information-circle"
              title="Hồ sơ sẽ cần duyệt lại"
              message="Bạn đang đổi Loại xe hoặc Biển số. Sau khi lưu, hồ sơ chuyển về CHỜ DUYỆT và bạn tạm ngoại tuyến cho đến khi được xác minh."
              className="mb-3"
            />
          )}

          {/* CHỌN LOẠI PHƯƠNG TIỆN */}
          <SectionCard title="Loại phương tiện" icon="bicycle" className="mb-3">
            <View className="flex-row gap-2">
              {VEHICLE_OPTIONS.map((opt) => {
                const selected = vehicleType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setForm((prev) => ({ ...prev, vehicleType: opt.type }))}
                    className={cn(
                      'flex-1 items-center gap-1.5 rounded-xl border-2 py-3',
                      selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                    )}
                  >
                    <View
                      className={cn(
                        'h-10 w-10 items-center justify-center rounded-full',
                        selected ? 'bg-brand-500' : 'bg-canvas-subtle',
                      )}
                    >
                      <Icon name={opt.icon} size="md" tone={selected ? 'inverse' : 'secondary'} />
                    </View>
                    <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'secondary'}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* THÔNG TIN CHI TIẾT XE */}
          <SectionCard title="Chi tiết phương tiện" icon="car-sport" iconTone="accent" iconBox="bg-accent-50" className="mb-3">

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
          </SectionCard>

          {/* LIÊN HỆ KHẨN CẤP */}
          <SectionCard title="Người liên hệ khẩn cấp" icon="call" iconTone="danger" iconBox="bg-danger-soft" className="mb-3">

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
          </SectionCard>

          {/* TÀI KHOẢN NGÂN HÀNG (NHẬN DOANH THU) */}
          <SectionCard title="Tài khoản nhận doanh thu" icon="card" iconTone="success" iconBox="bg-success-soft">

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
          </SectionCard>
        </ScrollView>

        {/* NÚT LƯU cố định ở đáy */}
        <View
          className="rounded-t-3xl bg-surface px-4 pt-3 shadow-float"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Button
            label="Lưu thông tin phương tiện"
            variant="primary"
            size="lg"
            leftIcon="save-outline"
            loading={updateMutation.isPending}
            onPress={handleSave}
          />
        </View>
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
    </View>
  );
};
