import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { driversApi } from '../../../api/drivers';
import { DriverVerificationStatus, User } from '../../../types/api';
import { formatDateTime, formatVND } from '../../../utils/format';
import { Badge, BadgeTone, BottomSheet, Button, Divider, Input, Text, useToast } from '../../ui';
import { InfoRow, vehicleLabel } from './adminShared';

export const DRIVER_STATUS_META: Record<DriverVerificationStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ duyệt xe', tone: 'warning' },
  APPROVED: { label: 'Xe đã duyệt', tone: 'success' },
  REJECTED: { label: 'Từ chối xe', tone: 'danger' },
  SUSPENDED: { label: 'Tạm khoá xe', tone: 'danger' },
};

/** Xét duyệt hồ sơ phương tiện & Quản lý công nợ COD của tài xế. */
export const DriverVerifySheet: React.FC<{ user: User | null; onClose: () => void }> = ({ user, onClose }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState(user?.driverProfile?.rejectionReason ?? '');
  const [codAmountText, setCodAmountText] = useState('');
  const [codNote, setCodNote] = useState('');

  const profile = user?.driverProfile;

  const { data: ledgerData, refetch: refetchLedger } = useQuery({
    queryKey: ['admin', 'driver-ledger', user?.id],
    queryFn: () => driversApi.adminGetDriverLedger(user!.id, { page: 1, limit: 5 }),
    enabled: Boolean(user?.id && user?.role === 'DRIVER'),
  });

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

  const settlementMutation = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note?: string }) =>
      driversApi.adminRecordSettlement(user!.id, { amount, note }),
    onSuccess: () => {
      setCodAmountText('');
      setCodNote('');
      refetchLedger();
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast('Đã ghi nhận tài xế nộp tiền COD', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể ghi nhận nộp tiền', 'error'),
  });

  const adjustmentMutation = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note: string }) =>
      driversApi.adminRecordAdjustment(user!.id, { amount, note }),
    onSuccess: () => {
      setCodAmountText('');
      setCodNote('');
      refetchLedger();
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast('Đã điều chỉnh công nợ COD', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể điều chỉnh công nợ', 'error'),
  });

  const needReason = (status: DriverVerificationStatus) => {
    if (!reason.trim()) {
      toast('Vui lòng nhập lý do', 'error');
      return;
    }
    verify.mutate(status);
  };

  const handleSettlement = () => {
    const amount = parseInt(codAmountText.trim(), 10);
    if (!Number.isFinite(amount) || amount < 1000) {
      toast('Nhập số tiền nộp tối thiểu 1.000đ', 'error');
      return;
    }
    settlementMutation.mutate({ amount, note: codNote.trim() || undefined });
  };

  const handleAdjustment = () => {
    const amount = parseInt(codAmountText.trim(), 10);
    if (!Number.isFinite(amount) || amount === 0) {
      toast('Nhập số tiền điều chỉnh khác 0 (hỗ trợ số âm hoặc dương)', 'error');
      return;
    }
    if (!codNote.trim()) {
      toast('Vui lòng nhập ghi chú lý do khi điều chỉnh công nợ', 'error');
      return;
    }
    adjustmentMutation.mutate({ amount, note: codNote.trim() });
  };

  const codBalance = ledgerData?.balance ?? profile?.codBalance ?? 0;
  const codLimit = ledgerData?.limit ?? 2000000;

  return (
    <BottomSheet
      visible={!!user}
      onClose={onClose}
      title={`Hồ sơ & Công nợ – ${user?.fullName ?? ''}`}
      footer={
        <View className="gap-2 pb-2">
          <Button
            label="Phê duyệt hồ sơ"
            leftIcon="checkmark"
            size="lg"
            loading={verify.isPending}
            onPress={() => verify.mutate('APPROVED')}
          />
          <View className="flex-row gap-2">
            <Button
              label="Từ chối"
              variant="outline"
              size="md"
              className="flex-1"
              disabled={verify.isPending}
              onPress={() => needReason('REJECTED')}
            />
            <Button
              label="Tạm khoá"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={verify.isPending}
              onPress={() => needReason('SUSPENDED')}
            />
          </View>
        </View>
      }
    >
      <ScrollView className="max-h-96" contentContainerClassName="gap-3 pb-3">
        {profile ? (
          <Badge
            label={DRIVER_STATUS_META[profile.verificationStatus].label}
            tone={DRIVER_STATUS_META[profile.verificationStatus].tone}
          />
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

        <Divider />

        {/* C4: Quản lý công nợ COD */}
        <View className="gap-2.5 rounded-xl border border-line bg-surface p-3">
          <View className="flex-row items-center justify-between">
            <Text variant="headline" weight="bold">
              Công nợ COD
            </Text>
            <Text variant="body" weight="bold" tone={codBalance >= codLimit ? 'danger' : 'brand'}>
              {formatVND(codBalance)} / {formatVND(codLimit)}
            </Text>
          </View>

          <Input
            label="Số tiền (VNĐ)"
            placeholder="Ví dụ: 200000 hoặc -50000"
            keyboardType="numbers-and-punctuation"
            value={codAmountText}
            onChangeText={setCodAmountText}
          />
          <Input
            label="Ghi chú nộp tiền / lý do điều chỉnh"
            placeholder="Ví dụ: Nộp tiền mặt tại quầy..."
            value={codNote}
            onChangeText={setCodNote}
          />

          <View className="flex-row gap-2">
            <Button
              label="Ghi nhận nộp tiền"
              variant="primary"
              size="sm"
              className="flex-1"
              loading={settlementMutation.isPending}
              disabled={codBalance <= 0}
              onPress={handleSettlement}
            />
            <Button
              label="Điều chỉnh"
              variant="secondary"
              size="sm"
              className="flex-1"
              loading={adjustmentMutation.isPending}
              onPress={handleAdjustment}
            />
          </View>

          {(ledgerData?.items?.length ?? 0) > 0 && (
            <View className="mt-1 gap-1.5 border-t border-line-subtle pt-2">
              <Text variant="caption" weight="bold" tone="secondary">
                Giao dịch công nợ gần nhất
              </Text>
              {ledgerData!.items.slice(0, 3).map((entry) => (
                <View key={entry.id} className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text variant="caption" numberOfLines={1}>
                      {entry.note || entry.type}
                    </Text>
                    <Text variant="micro" tone="muted">
                      {formatDateTime(entry.createdAt)}
                    </Text>
                  </View>
                  <Text
                    variant="caption"
                    weight="bold"
                    tone={entry.amount > 0 ? 'danger' : 'success'}
                  >
                    {entry.amount > 0 ? `+${formatVND(entry.amount)}` : formatVND(entry.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
