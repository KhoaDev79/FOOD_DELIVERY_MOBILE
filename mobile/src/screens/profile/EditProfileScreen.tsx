import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../api/users';
import { Button, ConfirmDialog, Icon, Input, Text, TopBar, useToast } from '../../components/ui';
import { useUpdateProfile, useUploadAvatar } from '../../services/useUser';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';
import { resolveImageUrl } from '../../utils/image';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  // Toast thay cho Alert.alert: Alert không hiện gì trên web.
  const toast = useToast();
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();

  // Profile fields
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Xoá tài khoản (Quy định Google Play / App Store)
  const logout = useAuthStore((s) => s.logout);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      await usersApi.deleteAccount();
      setShowDeleteDialog(false);
      toast('Tài khoản của bạn đã được xoá thành công.', 'success');
      await logout();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể xoá tài khoản. Vui lòng thử lại sau.';
      toast(msg, 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Chọn ảnh từ thư viện
  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast('Vui lòng cấp quyền truy cập ảnh để tải ảnh đại diện lên.', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAvatarUrl(asset.uri);
        setSelectedImageUri(asset.uri);
      }
    } catch {
      toast('Không thể mở thư viện ảnh.', 'error');
    }
  };

  // Cập nhật thông tin cá nhân
  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast('Vui lòng nhập họ và tên', 'error');
      return;
    }

    try {
      setIsUpdatingProfile(true);

      let finalAvatarUrl = avatarUrl;
      if (selectedImageUri) {
        const uploadRes = await uploadAvatarMutation.mutateAsync(selectedImageUri);
        finalAvatarUrl = uploadRes.avatarUrl || avatarUrl;
        setSelectedImageUri(null);
      }

      await updateProfileMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        avatarUrl: finalAvatarUrl?.trim() || undefined,
      });

      toast('Đã cập nhật thông tin cá nhân.', 'success');
      navigation.goBack();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || 'Không thể cập nhật thông tin.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast('Vui lòng nhập mật khẩu hiện tại', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast('Mật khẩu mới phải có ít nhất 8 ký tự', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await usersApi.changePassword({
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Đổi mật khẩu thành công. Hãy dùng mật khẩu mới cho lần đăng nhập sau.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || 'Không thể đổi mật khẩu.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      <TopBar title="Chỉnh sửa tài khoản" onLeadingPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView
          style={{ flex: 1 }}
          className="flex-1"
          contentContainerClassName="px-4 py-5 gap-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar selector */}
          <View className="items-center">
            <Pressable onPress={handlePickAvatar} className="relative active:opacity-80">
              {avatarUrl ? (
                <Image
                  source={{ uri: resolveImageUrl(avatarUrl) || avatarUrl }}
                  className="h-24 w-24 rounded-full border-2 border-brand-500"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-full bg-canvas-subtle border border-line">
                  <Icon name="person" size={48} tone="muted" />
                </View>
              )}
              <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-brand-500 shadow-card">
                <Icon name="camera" size={16} tone="inverse" />
              </View>
            </Pressable>
            <Text variant="caption" tone="secondary" className="mt-2">
              Chạm để đổi ảnh đại diện
            </Text>
          </View>

          {/* Form thông tin cá nhân */}
          <View className="gap-2.5">
            <Text variant="caption" weight="bold" tone="secondary" className="px-1 uppercase">
              Thông tin cá nhân
            </Text>
            <View className="rounded-xl border border-line bg-surface p-4 shadow-card gap-3.5">
              <Input
                label="Họ và tên *"
                placeholder="VD: Nguyễn Văn A"
                value={fullName}
                onChangeText={setFullName}
                leftIcon="person-outline"
              />
              <Input
                label="Số điện thoại"
                placeholder="VD: 0387466222"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                leftIcon="call-outline"
              />
              <Input
                label="Email"
                placeholder="VD: user@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />
              <Button
                label="Lưu thông tin cá nhân"
                onPress={handleSaveProfile}
                loading={isUpdatingProfile}
                variant="primary"
                size="md"
                className="mt-1"
              />
            </View>
          </View>

          {/* Form Đổi mật khẩu */}
          <View className="gap-2.5 mb-6">
            <Text variant="caption" weight="bold" tone="secondary" className="px-1 uppercase">
              Đổi mật khẩu đăng nhập
            </Text>
            <View className="rounded-xl border border-line bg-surface p-4 shadow-card gap-3.5">
              <Input
                label="Mật khẩu hiện tại *"
                placeholder="Nhập mật khẩu hiện tại"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                password
                leftIcon="lock-closed-outline"
              />
              <Input
                label="Mật khẩu mới (tối thiểu 8 ký tự) *"
                placeholder="Nhập mật khẩu mới"
                value={newPassword}
                onChangeText={setNewPassword}
                password
                leftIcon="lock-closed-outline"
              />
              <Input
                label="Xác nhận mật khẩu mới *"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                password
                leftIcon="lock-closed-outline"
              />
              <Button
                label="Đổi mật khẩu"
                onPress={handleChangePassword}
                loading={isUpdatingPassword}
                variant="outline"
                size="md"
                className="mt-1"
              />
            </View>
          </View>

          {/* Xoá tài khoản */}
          <View className="mb-10">
            <Button
              label="Xoá tài khoản"
              variant="dangerSoft"
              size="md"
              leftIcon="trash-outline"
              onPress={() => setShowDeleteDialog(true)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={showDeleteDialog}
        title="Xác nhận xoá tài khoản?"
        message="Hành động này không thể hoàn tác. Bạn sẽ bị đăng xuất ngay lập tức và toàn bộ thông tin cá nhân sẽ bị ẩn danh vĩnh viễn."
        confirmLabel="Xoá vĩnh viễn"
        cancelLabel="Giữ lại tài khoản"
        destructive
        loading={isDeletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </SafeAreaView>
  );
};
