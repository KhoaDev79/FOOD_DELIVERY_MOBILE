import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { adminApi, AdminRoleRequest } from '../../../api/admin';
import { Avatar, Badge, BottomSheet, Button, FilterChip, Input, Text, useToast } from '../../ui';
import { palette } from '../../../theme';
import { RoleRequestStatus } from '../../../types/api';
import { formatDateTime } from '../../../utils/format';
import { InfoRow, REQUEST_STATUS_META, ROLE_META, vehicleLabel } from './adminShared';

const TABS: { value: RoleRequestStatus; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
];

/** Danh sách yêu cầu nâng cấp vai trò (Khách → Chủ quán / Tài xế) và thao tác duyệt / từ chối. */
export const RoleRequestsSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [tab, setTab] = useState<RoleRequestStatus>('PENDING');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'role-requests', tab],
    queryFn: () => adminApi.listRoleRequests(tab),
    enabled: visible,
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Yêu cầu nâng cấp vai trò">
      <View className="flex-row gap-2 pb-3">
        {TABS.map((t) => (
          <FilterChip key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
        ))}
      </View>
      {isLoading ? (
        <View className="py-10">
          <ActivityIndicator color={palette.brand['500']} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-6">
          {(data ?? []).length === 0 ? (
            <Text variant="body" tone="muted" className="py-8 text-center">
              {tab === 'PENDING' ? 'Không có yêu cầu nào đang chờ duyệt.' : 'Chưa có yêu cầu nào.'}
            </Text>
          ) : (
            data!.map((r) => <RequestCard key={r.id} request={r} />)
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
};

const RequestCard: React.FC<{ request: AdminRoleRequest }> = ({ request: r }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const m = r.metadata ?? {};
  const isDriver = r.requestedRole === 'DRIVER';

  const review = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') =>
      adminApi.reviewRoleRequest(r.id, status, status === 'REJECTED' ? reason.trim() : undefined),
    onSuccess: (_res, status) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(
        status === 'APPROVED'
          ? `${r.user.fullName} đã trở thành ${ROLE_META[r.requestedRole].label}`
          : 'Đã từ chối yêu cầu',
        'success',
      );
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể xử lý yêu cầu', 'error'),
  });

  return (
    <View className="gap-2 rounded-2xl border border-line-subtle bg-surface p-3">
      <View className="flex-row items-center gap-3">
        <Avatar uri={r.user.avatarUrl} name={r.user.fullName} size="md" />
        <View className="flex-1">
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {r.user.fullName}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            {r.user.email}
            {r.user.phone ? ` • ${r.user.phone}` : ''}
          </Text>
        </View>
        <Badge label={REQUEST_STATUS_META[r.status].label} tone={REQUEST_STATUS_META[r.status].tone} size="sm" />
      </View>

      <Badge
        label={`Muốn làm ${ROLE_META[r.requestedRole].label}`}
        tone={ROLE_META[r.requestedRole].tone}
        icon={ROLE_META[r.requestedRole].icon}
      />

      <View className="rounded-xl bg-canvas-subtle px-3 py-1">
        {isDriver ? (
          <>
            <InfoRow label="Loại xe" value={vehicleLabel(m.vehicleType)} />
            <InfoRow label="Biển số" value={m.licensePlate || '—'} />
            <InfoRow
              label="Xe"
              value={[m.vehicleBrand, m.vehicleModel, m.vehicleColor].filter(Boolean).join(' • ') || '—'}
            />
          </>
        ) : (
          <>
            <InfoRow label="Tên quán dự kiến" value={m.restaurantName || '—'} />
            <InfoRow label="Địa chỉ" value={m.restaurantAddress || '—'} />
          </>
        )}
        {!!r.note && <InfoRow label="Ghi chú" value={r.note} />}
        <InfoRow label="Gửi lúc" value={formatDateTime(r.createdAt)} />
      </View>

      {r.status === 'PENDING' ? (
        rejecting ? (
          <View className="gap-2">
            <Input label="Lý do từ chối *" placeholder="VD: Thông tin xe chưa đầy đủ" value={reason} onChangeText={setReason} />
            <View className="flex-row gap-2">
              <Button label="Quay lại" variant="outline" size="md" className="flex-1" onPress={() => setRejecting(false)} />
              <Button
                label="Xác nhận từ chối"
                variant="danger"
                size="md"
                className="flex-1"
                disabled={!reason.trim()}
                loading={review.isPending}
                onPress={() => review.mutate('REJECTED')}
              />
            </View>
          </View>
        ) : (
          <View className="flex-row gap-2">
            <Button label="Từ chối" variant="outline" size="md" className="flex-1" onPress={() => setRejecting(true)} />
            <Button
              label="Phê duyệt"
              leftIcon="checkmark"
              size="md"
              className="flex-1"
              loading={review.isPending}
              onPress={() => review.mutate('APPROVED')}
            />
          </View>
        )
      ) : (
        <Text variant="micro" weight="regular" tone="muted">
          {r.status === 'APPROVED' ? 'Duyệt' : 'Từ chối'} bởi {r.reviewedBy?.fullName ?? '—'}
          {r.reviewedAt ? ` lúc ${formatDateTime(r.reviewedAt)}` : ''}
          {r.reviewNote ? ` – ${r.reviewNote}` : ''}
        </Text>
      )}
    </View>
  );
};
