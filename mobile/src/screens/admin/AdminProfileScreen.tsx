import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { adminApi } from '../../api/admin';
import { ContentWidth, useIsWide } from '../../components/modules/admin/AdminKit';
import { InfoRow, RoleBadge } from '../../components/modules/admin/adminShared';
import {
  Avatar,
  BottomSheet,
  cn,
  CountBadge,
  Divider,
  Icon,
  IconName,
  IconTone,
  ListRow,
  LogoutButton,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { API_BASE_URL } from '../../constants/config';
import { useRefunds } from '../../services/useOrders';
import { useAuthStore } from '../../store/useAuthStore';

const ICON_BOX: Partial<Record<IconTone, string>> = {
  brand: 'bg-brand-50',
  accent: 'bg-accent-50',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
  warning: 'bg-warning-soft',
  violet: 'bg-violet-soft',
  info: 'bg-info-soft',
  secondary: 'bg-canvas-subtle',
};

/** Icon màu trong vòng tròn nền nhạt cùng màu (thay vòng xám mặc định của ListRow). */
const ColorIcon: React.FC<{ name: IconName; tone: IconTone }> = ({ name, tone }) => (
  <View className={cn('h-10 w-10 items-center justify-center rounded-full', ICON_BOX[tone] ?? 'bg-canvas-subtle')}>
    <Icon name={name} size="md" tone={tone} />
  </View>
);

/** Số việc đang chờ + mũi tên; không có việc thì chỉ mũi tên. */
const Pending: React.FC<{ count?: number }> = ({ count }) => (
  <View className="flex-row items-center gap-2">
    {!!count && <CountBadge count={count} />}
    <Icon name="chevron-forward" size="sm" tone="muted" />
  </View>
);

const Group: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <View className={cn('gap-2', className)}>
    <Text variant="caption" weight="semibold" tone="muted" className="px-1 uppercase">
      {title}
    </Text>
    <View className="rounded-2xl bg-surface px-3 shadow-card">{children}</View>
  </View>
);

/** Tab Hệ thống: trung tâm cấu hình, nhóm rõ ràng, mỗi dòng có icon màu và số việc đang chờ. */
export const AdminProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const toast = useToast();
  const queryClient = useQueryClient();
  const wide = useIsWide();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [techOpen, setTechOpen] = useState(false);

  const { data: attention } = useQuery({ queryKey: ['admin', 'attention'], queryFn: () => adminApi.getAttention() });

  const handleClearCache = () => {
    queryClient.clear();
    toast('Đã xoá bộ nhớ tạm, dữ liệu sẽ được tải lại', 'success');
  };

  const content = (
    <Group title="Nội dung">
      <ListRow
        leading={<ColorIcon name="images" tone="brand" />}
        title="Banner & quảng cáo"
        subtitle="Ảnh khuyến mãi đầu trang chủ, lịch chạy"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminBanners')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="grid" tone="accent" />}
        title="Danh mục ẩm thực"
        subtitle="Bún - Phở, Cơm, Trà sữa… và từ khoá lọc quán"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminCuisines')}
      />
    </Group>
  );

  const debtCount = (attention?.driversOverDebt ?? 0) + (attention?.driversNearDebt ?? 0);
  const { data: pendingRefunds } = useRefunds('pending');
  const operations = (
    <Group title="Vận hành">
      <ListRow
        leading={<ColorIcon name="person-add" tone="warning" />}
        title="Yêu cầu mở quán / làm tài xế"
        subtitle="Duyệt nâng cấp vai trò"
        trailing={<Pending count={attention?.roleRequests} />}
        onPress={() => navigation.navigate('AdminUsersTab', { openRequests: true })}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="wallet" tone="success" />}
        title="Đối soát COD tài xế"
        subtitle={attention ? `Hạn mức công nợ ${attention.debtLimit.toLocaleString('vi-VN')} ₫` : 'Công nợ tiền mặt của tài xế'}
        trailing={<Pending count={debtCount} />}
        onPress={() => navigation.navigate('AdminUsersTab', { tab: 'DRIVER' })}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="document-text" tone="violet" />}
        title="Nhật ký quản trị"
        subtitle="Ai đã làm gì, lúc nào"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminAuditLog')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="help-buoy" tone="brand" />}
        title="Hỗ trợ khách hàng (CSKH)"
        subtitle="Xử lý khiếu nại & phiếu hỗ trợ"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminSupportTickets')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="book" tone="success" />}
        title="Bài viết trợ giúp (FAQ)"
        subtitle="Soạn bài, xem lượt đọc và 👍👎"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminHelpArticles')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="sparkles" tone="violet" />}
        title="Trợ lý tự động"
        subtitle="Thống kê chatbot, câu hỏi chưa trả lời được"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminBotInsights')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="pricetags" tone="accent" />}
        title="Voucher & khuyến mãi"
        subtitle="Mã giảm giá, freeship toàn sàn; voucher bồi thường"
        trailing={<Pending />}
        onPress={() => navigation.navigate('AdminVouchers')}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="return-down-back" tone="info" />}
        title="Hoàn tiền đơn online"
        subtitle="Đơn VNPay bị huỷ / giao thất bại cần hoàn tiền"
        trailing={<Pending count={pendingRefunds?.length} />}
        onPress={() => navigation.navigate('AdminRefunds')}
      />
    </Group>
  );

  const system = (
    <Group title="Hệ thống">
      <ListRow
        leading={<ColorIcon name="refresh" tone="info" />}
        title="Làm mới dữ liệu"
        subtitle="Xoá bộ nhớ tạm và tải lại số liệu"
        showChevron={false}
        onPress={handleClearCache}
      />
      <Divider inset />
      <ListRow
        leading={<ColorIcon name="code-slash" tone="secondary" />}
        title="Phiên bản & kỹ thuật"
        subtitle="Dành cho nhà phát triển"
        trailing={<Pending />}
        onPress={() => setTechOpen(true)}
      />
    </Group>
  );

  const account = (
    <Group title="Tài khoản">
      <ListRow
        leading={<ColorIcon name="person" tone="danger" />}
        title="Hồ sơ & mật khẩu"
        subtitle={user?.email}
        trailing={<Pending />}
        onPress={() => navigation.navigate('EditProfile')}
      />
    </Group>
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE} showsVerticalScrollIndicator={false}>
        <TabHeader compact title="Hệ thống" subtitle="Cấu hình, vận hành và tài khoản">
          <ContentWidth className="flex-row items-center gap-3 rounded-2xl bg-surface/15 p-3">
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size="md" className="border-2 border-surface/60" />
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="bold" tone="inverse" numberOfLines={1}>
                {user?.fullName || 'Quản trị viên'}
              </Text>
              <Text variant="caption" weight="regular" tone="inverse" className="opacity-80" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <RoleBadge role="ADMIN" />
          </ContentWidth>
        </TabHeader>

        <ContentWidth className="gap-5 px-4 pt-5">
          {wide ? (
            <View className="flex-row items-start gap-4">
              <View className="flex-1 gap-5">
                {operations}
                {content}
              </View>
              <View className="flex-1 gap-5">
                {system}
                {account}
              </View>
            </View>
          ) : (
            <>
              {operations}
              {content}
              {system}
              {account}
            </>
          )}
          <LogoutButton onLogout={logout} message="Bạn sẽ cần đăng nhập lại để vào trang quản trị." />
        </ContentWidth>
      </ScrollView>

      {/* Thông số kỹ thuật: chỉ hiện khi bấm, không để lộ trên màn chính */}
      <BottomSheet visible={techOpen} onClose={() => setTechOpen(false)} title="Phiên bản & kỹ thuật">
        <View className="pb-6">
          <InfoRow label="Phiên bản ứng dụng" value={Constants.expoConfig?.version ?? '—'} />
          <InfoRow label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? '—'} />
          <InfoRow label="Nền tảng" value={`${Platform.OS} ${Platform.Version ?? ''}`.trim()} />
          <InfoRow label="Môi trường" value={__DEV__ ? 'Development' : 'Production'} />
          <InfoRow label="API" value={API_BASE_URL} />
        </View>
      </BottomSheet>
    </View>
  );
};
