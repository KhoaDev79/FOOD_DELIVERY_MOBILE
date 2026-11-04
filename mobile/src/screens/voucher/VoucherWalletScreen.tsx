import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import { VoucherTicket } from '../../components/modules/voucher/VoucherTicket';
import { EmptyState, ErrorState, Skeleton, Text, TopBar } from '../../components/ui';
import { useVoucherWallet } from '../../services/useVouchers';
import { VoucherView } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';

type Tab = 'available' | 'history';

/** Ví voucher của khách: mã còn dùng được (mã tặng riêng xếp đầu) và lịch sử mã đã dùng / hết hạn. */
export const VoucherWalletScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<Tab>('available');
  const query = useVoucherWallet(tab);

  const goUse = (v: VoucherView) => {
    if (v.restaurant) navigation.navigate('RestaurantDetail', { restaurantId: v.restaurant.id });
    else navigation.navigate('MainTabs', { screen: 'HomeTab' });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar title="Ví voucher" onLeadingPress={() => navigation.goBack()} className="bg-canvas-subtle" />
      <View className="px-4 pb-2">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          trackClassName="bg-line"
          items={[
            { key: 'available', label: 'Có thể dùng', icon: 'ticket-outline' },
            { key: 'history', label: 'Đã dùng / hết hạn', icon: 'time-outline' },
          ]}
        />
      </View>

      {query.isLoading ? (
        <View className="gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(v, i) => `${v.id}-${v.orderId ?? i}`}
          contentContainerClassName="gap-3 p-4 pb-10"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
          ListHeaderComponent={
            tab === 'available' && (query.data?.length ?? 0) > 0 ? (
              <Text variant="caption" weight="regular" tone="secondary">
                Chọn mã ở bước Thanh toán. Mỗi đơn dùng tối đa 1 mã giảm giá và 1 mã freeship.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <VoucherTicket
              voucher={item}
              right={
                tab === 'available' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Dùng mã ${item.code}`}
                    onPress={() => goUse(item)}
                    className="rounded-full bg-brand-500 px-3 py-1.5 active:opacity-80"
                  >
                    <Text variant="caption" weight="bold" tone="inverse">
                      Dùng
                    </Text>
                  </Pressable>
                ) : undefined
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              variant="card"
              icon="ticket-outline"
              title={tab === 'available' ? 'Ví voucher đang trống' : 'Chưa có lịch sử'}
              description={
                tab === 'available'
                  ? 'Các mã giảm giá, freeship và quà tặng riêng cho bạn sẽ hiện ở đây.'
                  : 'Mã bạn đã dùng hoặc đã hết hạn sẽ hiện ở đây.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
};
