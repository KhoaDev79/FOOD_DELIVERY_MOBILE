import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';
import { driversApi } from '../../../api/drivers';
import { Badge, BadgeTone, BottomSheet, Button, Input, useToast } from '../../ui';
import { DriverVerificationStatus, User } from '../../../types/api';
import { InfoRow, vehicleLabel } from './adminShared';

export const DRIVER_STATUS_META: Record<DriverVerificationStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ duyệt xe', tone: 'warning' },
  APPROVED: { label: 'Xe đã duyệt', tone: 'success' },
  REJECTED: { label: 'Từ chối xe', tone: 'danger' },
  SUSPENDED: { label: 'Tạm khoá xe', tone: 'danger' },
};

/** Xét duyệt hồ sơ phương tiện của tài xế. */
export const DriverVerifySheet: React.FC<{ user: User | null; onClose: () => void }> = ({ user, onClose }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  // Nơi dùng đặt `key` theo người dùng nên giá trị ban đầu được lấy lại mỗi lần mở
  const [reason, setReason] = useState(user?.driverProfile?.rejectionReason ?? '');
  const profile = user?.driverProfile;

  const verify = useMutation({
    mutationFn: (status: DriverVerificationStatus) =>
      driversApi.adminVerifyDriver(user!.id, { status, reason: reason.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast('Đã cập nhật hồ sơ tài xế', 'success');
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể duyệt hồ sơ', 'error'),
  });

  const needReason = (status: DriverVerificationStatus) => {
    if (!reason.trim()) {
      toast('Vui lòng nhập lý do', 'error');
      return;
    }
    verify.mutate(status);
  };

  return (
    <BottomSheet
      visible={!!user}
      onClose={onClose}
      title={`Hồ sơ xe – ${user?.fullName ?? ''}`}
      footer={
        <View className="gap-2 pb-2">
          <Button label="Phê duyệt hồ sơ" leftIcon="checkmark" size="lg" loading={verify.isPending} onPress={() => verify.mutate('APPROVED')} />
          <View className="flex-row gap-2">
            <Button label="Từ chối" variant="outline" size="md" className="flex-1" disabled={verify.isPending} onPress={() => needReason('REJECTED')} />
            <Button label="Tạm khoá" variant="danger" size="md" className="flex-1" disabled={verify.isPending} onPress={() => needReason('SUSPENDED')} />
          </View>
        </View>
      }
    >
      <View className="gap-3 pb-3">
        {profile ? (
          <Badge label={DRIVER_STATUS_META[profile.verificationStatus].label} tone={DRIVER_STATUS_META[profile.verificationStatus].tone} />
        ) : (
          <Badge label="Chưa nộp hồ sơ xe" tone="neutral" />
        )}
        <View className="rounded-xl bg-canvas-subtle px-3 py-1">
          <InfoRow label="Loại xe" value={vehicleLabel(profile?.vehicleType)} />
          <InfoRow
            label="Hãng & dòng xe"
            value={[profile?.vehicleBrand, profile?.vehicleModel].filter(Boolean).join(' ') || 'Chưa cập nhật'}
          />
          <InfoRow label="Màu xe" value={profile?.vehicleColor || '—'} />
          <InfoRow label="Biển số" value={profile?.licensePlate || 'Chưa cập nhật'} />
        </View>
        <Input
          label="Lý do (bắt buộc khi từ chối / tạm khoá)"
          placeholder="Nhập lý do..."
          value={reason}
          onChangeText={setReason}
        />
      </View>
    </BottomSheet>
  );
};
