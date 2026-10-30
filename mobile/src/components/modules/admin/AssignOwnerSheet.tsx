import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { adminApi, AdminRestaurantItem } from '../../../api/admin';
import { Avatar, BottomSheet, Button, cn, FilterChip, Icon, SearchBar, Text, useToast } from '../../ui';
import { palette } from '../../../theme';
import { Role, User } from '../../../types/api';
import { RoleBadge } from './adminShared';

const ROLE_TABS: { label: string; value: Extract<Role, 'RESTAURANT_OWNER' | 'CUSTOMER'> }[] = [
  { label: 'Chủ quán', value: 'RESTAURANT_OWNER' },
  { label: 'Khách hàng', value: 'CUSTOMER' },
];

/**
 * Chọn một người dùng để làm (hoặc bàn giao) chủ quán. Khách hàng sẽ được nâng lên Chủ quán.
 * Nơi dùng đặt `key` theo id quán để lựa chọn được làm mới mỗi lần mở cho quán khác.
 */
export const AssignOwnerSheet: React.FC<{
  restaurant: AdminRestaurantItem | null;
  onClose: () => void;
}> = ({ restaurant, onClose }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'RESTAURANT_OWNER' | 'CUSTOMER'>('RESTAURANT_OWNER');
  const [selected, setSelected] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'assign-candidates', role, q.trim()],
    queryFn: () => adminApi.listUsers({ role, q: q.trim() || undefined, limit: 30 }),
    enabled: !!restaurant,
  });
  const candidates = (data?.items ?? []).filter((u) => u.isActive && u.id !== restaurant?.owner.id);

  const assign = useMutation({
    mutationFn: (user: User) => adminApi.assignOwner(restaurant!.id, user.id),
    onSuccess: (res, user) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(
        res.promoted
          ? `Đã gán quán cho ${user.fullName} và nâng lên Chủ quán`
          : `Đã bàn giao quán cho ${user.fullName}`,
        'success',
      );
      onClose();
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể gán chủ quán', 'error'),
  });

  return (
    <BottomSheet
      visible={!!restaurant}
      onClose={onClose}
      title={`Gán chủ quán – ${restaurant?.name ?? ''}`}
      footer={
        <View className="gap-2 pb-2">
          {selected?.role === 'CUSTOMER' && (
            <View className="flex-row items-start gap-2 rounded-lg bg-warning-soft p-2.5">
              <Icon name="information-circle" size="sm" tone="accent" />
              <Text variant="caption" weight="regular" className="flex-1">
                {selected.fullName} đang là Khách hàng và sẽ được nâng lên Chủ quán (cần đăng nhập lại).
              </Text>
            </View>
          )}
          <Button
            label={selected ? `Gán cho ${selected.fullName}` : 'Chọn một người dùng'}
            leftIcon="key-outline"
            size="lg"
            disabled={!selected}
            loading={assign.isPending}
            onPress={() => selected && assign.mutate(selected)}
          />
        </View>
      }
    >
      <View className="gap-3 pb-3">
        {restaurant && (
          <View className="flex-row items-center gap-2 rounded-lg bg-canvas-subtle p-2.5">
            <Icon name="person-circle-outline" size="md" tone="secondary" />
            <Text variant="caption" tone="secondary" weight="regular" className="flex-1" numberOfLines={2}>
              Chủ hiện tại: {restaurant.owner.fullName} ({restaurant.owner.email})
            </Text>
          </View>
        )}
        <SearchBar
          value={q}
          onChangeText={setQ}
          onClear={() => setQ('')}
          placeholder="Tìm theo tên, email, số điện thoại"
          className="rounded-full"
        />
        <View className="flex-row gap-2">
          {ROLE_TABS.map((t) => (
            <FilterChip
              key={t.value}
              label={t.label}
              selected={role === t.value}
              onPress={() => {
                setRole(t.value);
                setSelected(null);
              }}
            />
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator color={palette.brand['500']} />
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(u) => u.id}
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 pb-3"
          ListEmptyComponent={
            <Text variant="body" tone="muted" className="py-8 text-center">
              Không tìm thấy người dùng phù hợp.
            </Text>
          }
          renderItem={({ item }) => {
            const active = selected?.id === item.id;
            const owned = item._count?.restaurants ?? 0;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(item)}
                className={cn(
                  'flex-row items-center gap-3 rounded-xl border p-3 active:opacity-80',
                  active ? 'border-brand-500 bg-brand-50' : 'border-line-subtle bg-surface',
                )}
              >
                <Avatar uri={item.avatarUrl} name={item.fullName} size="md" />
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
                    {item.email}
                  </Text>
                  <View className="mt-0.5 flex-row items-center gap-2">
                    <RoleBadge role={item.role} />
                    {item.role === 'RESTAURANT_OWNER' && (
                      <Text variant="micro" weight="regular" tone="muted">
                        Đang quản lý {owned} quán
                      </Text>
                    )}
                  </View>
                </View>
                <Icon name={active ? 'radio-button-on' : 'radio-button-off'} size="md" tone={active ? 'brand' : 'muted'} />
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
};
