import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../api/users';
import { REQUEST_STATUS_META } from '../../components/modules/admin/adminShared';
import {
  Badge,
  Button,
  ChoiceRow,
  cn,
  Icon,
  IconName,
  Input,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { VehicleType } from '../../types/api';
import { formatDateTime } from '../../utils/format';

type Target = 'RESTAURANT_OWNER' | 'DRIVER';

const TARGETS: { value: Target; title: string; desc: string; icon: IconName }[] = [
  { value: 'RESTAURANT_OWNER', title: 'Mở quán trên ZomZom', desc: 'Bán món, nhận đơn và quản lý thực đơn', icon: 'storefront' },
  { value: 'DRIVER', title: 'Trở thành tài xế', desc: 'Nhận chuyến giao hàng gần bạn', icon: 'bicycle' },
];

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: 'MOTORBIKE', label: 'Xe máy' },
  { value: 'ELECTRIC_MOTORBIKE', label: 'Xe máy điện' },
  { value: 'BICYCLE', label: 'Xe đạp' },
];

const TARGET_LABEL: Record<Target, string> = { RESTAURANT_OWNER: 'Chủ quán', DRIVER: 'Tài xế' };

/** Khách hàng gửi yêu cầu trở thành Chủ quán / Tài xế; admin duyệt trong trang quản trị. */
export const RoleUpgradeRequestScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Target>('RESTAURANT_OWNER');
  const [form, setForm] = useState({
    restaurantName: '',
    restaurantAddress: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    licensePlate: '',
    note: '',
  });
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORBIKE');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['me', 'role-requests'],
    queryFn: () => usersApi.myUpgradeRequests(),
  });
  const pending = requests?.find((r) => r.status === 'PENDING');

  const submit = useMutation({
    mutationFn: () =>
      usersApi.requestUpgrade(
        target === 'RESTAURANT_OWNER'
          ? {
              requestedRole: target,
              restaurantName: form.restaurantName.trim(),
              restaurantAddress: form.restaurantAddress.trim() || undefined,
              note: form.note.trim() || undefined,
            }
          : {
              requestedRole: target,
              vehicleType,
              vehicleBrand: form.vehicleBrand.trim() || undefined,
              vehicleModel: form.vehicleModel.trim() || undefined,
              vehicleColor: form.vehicleColor.trim() || undefined,
              licensePlate: vehicleType === 'BICYCLE' ? undefined : form.licensePlate.trim(),
              note: form.note.trim() || undefined,
            },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'role-requests'] });
      toast('Đã gửi yêu cầu, vui lòng chờ quản trị viên duyệt', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không gửi được yêu cầu', 'error'),
  });

  const onSubmit = () => {
    if (target === 'RESTAURANT_OWNER' && !form.restaurantName.trim()) {
      toast('Vui lòng nhập tên quán dự kiến', 'error');
      return;
    }
    if (target === 'DRIVER' && vehicleType !== 'BICYCLE' && !form.licensePlate.trim()) {
      toast('Vui lòng nhập biển số xe', 'error');
      return;
    }
    submit.mutate();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChangeText: (v: string) => setForm((f) => ({ ...f, [key]: v })),
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-canvas-subtle">
      <TopBar title="Hợp tác cùng ZomZom" onLeadingPress={() => navigation.goBack()} />
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-10">
            {pending ? (
              <View className="items-center gap-3 rounded-2xl bg-surface p-6 shadow-card">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-warning-soft">
                  <Icon name="hourglass-outline" size={30} tone="accent" />
                </View>
                <Text variant="headline" className="text-center">
                  Yêu cầu làm {TARGET_LABEL[pending.requestedRole]} đang chờ duyệt
                </Text>
                <Text variant="body" tone="secondary" className="text-center">
                  Gửi lúc {formatDateTime(pending.createdAt)}. Bạn sẽ nhận thông báo khi có kết quả, sau đó đăng nhập
                  lại để dùng tính năng mới.
                </Text>
              </View>
            ) : (
              <>
                <View className="gap-3">
                  {TARGETS.map((t) => {
                    const selected = target === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => setTarget(t.value)}
                        className={cn(
                          'flex-row items-center gap-3 rounded-2xl border-2 bg-surface p-4 shadow-card active:opacity-90',
                          selected ? 'border-brand-500' : 'border-transparent',
                        )}
                      >
                        <View
                          className={cn(
                            'h-12 w-12 items-center justify-center rounded-full',
                            selected ? 'bg-brand-500' : 'bg-brand-50',
                          )}
                        >
                          <Icon name={t.icon} size="lg" tone={selected ? 'inverse' : 'brand'} />
                        </View>
                        <View className="flex-1">
                          <Text variant="body-lg" weight="semibold">
                            {t.title}
                          </Text>
                          <Text variant="caption" weight="regular" tone="secondary">
                            {t.desc}
                          </Text>
                        </View>
                        <Icon
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size="lg"
                          tone={selected ? 'brand' : 'muted'}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
                  {target === 'RESTAURANT_OWNER' ? (
                    <>
                      <Input label="Tên quán dự kiến *" placeholder="VD: Bếp Nhà Mẫn" {...field('restaurantName')} />
                      <Input label="Địa chỉ quán" placeholder="Số nhà, đường, quận" {...field('restaurantAddress')} />
                    </>
                  ) : (
                    <>
                      <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
                        Loại phương tiện
                      </Text>
                      <View>
                        {VEHICLES.map((v) => (
                          <ChoiceRow
                            key={v.value}
                            kind="radio"
                            label={v.label}
                            selected={vehicleType === v.value}
                            onPress={() => setVehicleType(v.value)}
                          />
                        ))}
                      </View>
                      {vehicleType !== 'BICYCLE' && (
                        <Input
                          label="Biển số xe *"
                          placeholder="VD: 59-X1 123.45"
                          autoCapitalize="characters"
                          {...field('licensePlate')}
                        />
                      )}
                      <Input label="Hãng xe" placeholder="VD: Honda" {...field('vehicleBrand')} />
                      <Input label="Dòng xe" placeholder="VD: Wave Alpha" {...field('vehicleModel')} />
                      <Input label="Màu xe" placeholder="VD: Đỏ đen" {...field('vehicleColor')} />
                    </>
                  )}
                  <Input label="Ghi chú cho quản trị viên" placeholder="Tuỳ chọn" {...field('note')} />
                </View>

                <Button label="Gửi yêu cầu" leftIcon="paper-plane-outline" size="lg" loading={submit.isPending} onPress={onSubmit} />
              </>
            )}

            {/* Lịch sử yêu cầu */}
            {!!requests?.filter((r) => r.status !== 'PENDING').length && (
              <View className="gap-2">
                <Text variant="caption" weight="semibold" tone="muted" className="px-1 uppercase">
                  Yêu cầu trước đây
                </Text>
                {requests
                  .filter((r) => r.status !== 'PENDING')
                  .map((r) => (
                    <View key={r.id} className="gap-1 rounded-2xl bg-surface p-3 shadow-card">
                      <View className="flex-row items-center justify-between">
                        <Text variant="body" weight="semibold">
                          Làm {TARGET_LABEL[r.requestedRole]}
                        </Text>
                        <Badge label={REQUEST_STATUS_META[r.status].label} tone={REQUEST_STATUS_META[r.status].tone} size="sm" />
                      </View>
                      <Text variant="caption" weight="regular" tone="muted">
                        {formatDateTime(r.createdAt)}
                        {r.reviewNote ? ` • ${r.reviewNote}` : ''}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};
