import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { InfoRow, RoleBadge } from '../../components/modules/admin/adminShared';
import {
  Avatar,
  BottomSheet,
  Divider,
  ListRow,
  LogoutButton,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { API_BASE_URL } from '../../constants/config';
import { useAuthStore } from '../../store/useAuthStore';

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-2">
    <Text variant="caption" weight="semibold" tone="muted" className="px-1 uppercase">
      {title}
    </Text>
    <View className="rounded-2xl bg-surface px-3 shadow-card">{children}</View>
  </View>
);

export const AdminProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [techOpen, setTechOpen] = useState(false);

  const handleClearCache = () => {
    queryClient.clear();
    toast('Đã xoá bộ nhớ tạm, dữ liệu sẽ được tải lại', 'success');
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE} showsVerticalScrollIndicator={false}>
        <TabHeader title="Hệ thống">
          <View className="flex-row items-center gap-3">
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size="lg" className="border-2 border-surface/60" />
            <View className="flex-1 gap-1">
              <Text variant="headline" tone="inverse" numberOfLines={1}>
                {user?.fullName || 'Quản trị viên'}
              </Text>
              <Text variant="body" tone="inverse" className="opacity-85" numberOfLines={1}>
                {user?.email}
              </Text>
              <RoleBadge role="ADMIN" />
            </View>
          </View>
        </TabHeader>

        <View className="gap-5 px-4 pt-5">
          <Group title="Tài khoản">
            <ListRow
              icon="person-outline"
              iconTone="brand"
              title="Thông tin cá nhân & mật khẩu"
              onPress={() => navigation.navigate('EditProfile')}
            />
          </Group>

          <Group title="Nội dung trang chủ">
            <ListRow
              icon="images-outline"
              iconTone="brand"
              title="Banner & quảng cáo"
              subtitle="Ảnh khuyến mãi ở đầu trang chủ, lịch chạy"
              onPress={() => navigation.navigate('AdminBanners')}
            />
            <Divider inset />
            <ListRow
              icon="grid-outline"
              iconTone="accent"
              title="Danh mục ẩm thực"
              subtitle="Bún - Phở, Cơm, Trà sữa… và từ khoá lọc quán"
              onPress={() => navigation.navigate('AdminCuisines')}
            />
          </Group>

          <Group title="Vận hành">
            <ListRow
              icon="refresh-outline"
              iconTone="brand"
              title="Làm mới dữ liệu"
              subtitle="Xoá bộ nhớ tạm và tải lại số liệu"
              showChevron={false}
              onPress={handleClearCache}
            />
            <Divider inset />
            <ListRow
              icon="code-slash-outline"
              iconTone="secondary"
              title="Thông tin phiên bản & kỹ thuật"
              subtitle="Dành cho nhà phát triển"
              onPress={() => setTechOpen(true)}
            />
          </Group>

          <LogoutButton onLogout={logout} message="Bạn sẽ cần đăng nhập lại để vào trang quản trị." />
        </View>
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
