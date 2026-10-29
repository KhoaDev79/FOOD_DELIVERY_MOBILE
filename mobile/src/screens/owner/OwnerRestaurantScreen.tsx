import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';

export const OwnerRestaurantScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [restName, setRestName] = useState('');
  const [restAddress, setRestAddress] = useState('');
  const [restDescription, setRestDescription] = useState('');
  const [restImageUrl, setRestImageUrl] = useState('');

  const { data: restaurants, isLoading, refetch } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });

  const restaurant = restaurants?.[0];

  const toggleOpenMutation = useMutation({
    mutationFn: (isOpen: boolean) =>
      restaurantsApi.updateRestaurant(restaurant!.id, { isOpen }),
    onSuccess: () => refetch(),
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể đổi trạng thái quán');
    },
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: (data: any) => restaurantsApi.updateRestaurant(restaurant!.id, data),
    onSuccess: () => {
      refetch();
      setEditModalVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật thông tin nhà hàng!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật nhà hàng');
    },
  });

  const handleOpenEdit = () => {
    if (!restaurant) return;
    setRestName(restaurant.name);
    setRestAddress(restaurant.address);
    setRestDescription(restaurant.description || '');
    setRestImageUrl(restaurant.imageUrl || '');
    setEditModalVisible(true);
  };

  const handlePickCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập để chọn ảnh bìa.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setRestImageUrl(uri);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh');
    }
  };

  const handleSaveRestaurant = () => {
    if (!restName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhà hàng');
      return;
    }
    updateRestaurantMutation.mutate({
      name: restName.trim(),
      address: restAddress.trim(),
      description: restDescription.trim() || undefined,
      imageUrl: restImageUrl.trim() || undefined,
    });
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (isLoading) {
    return <LoadingSpinner message="Đang tải thông tin quán..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header Hồ Sơ Chủ Quán */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={32} color={colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || 'Chủ nhà hàng'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.roleTag}>Đối tác Quán ăn</Text>
          </View>
        </View>

        {restaurant && (
          <>
            {/* Thẻ Quán Ăn & Trạng Thái Bán Hàng */}
            <Card style={styles.restaurantCard}>
              <View style={styles.restHeaderRow}>
                <Image
                  source={{
                    uri:
                      restaurant.imageUrl ||
                      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
                  }}
                  style={styles.restImg}
                />
                <View style={styles.restHeaderInfo}>
                  <Text style={styles.restName}>{restaurant.name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.rating} />
                    <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.radiusText}>Bán kính: {restaurant.deliveryRadiusKm} km</Text>
                  </View>
                  <TouchableOpacity style={styles.editRestBtn} onPress={handleOpenEdit}>
                    <Ionicons name="pencil" size={14} color={colors.primary} />
                    <Text style={styles.editRestText}>Sửa thông tin quán</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Công tắc Nhận đơn */}
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleTitle}>
                    {restaurant.isOpen ? '🟢 Quán đang mở cửa' : '🔴 Quán đang đóng cửa'}
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    {restaurant.isOpen
                      ? 'Khách hàng có thể tìm thấy quán và đặt món'
                      : 'Tạm dừng nhận đơn hàng mới'}
                  </Text>
                </View>

                <Switch
                  value={restaurant.isOpen}
                  onValueChange={(val) => toggleOpenMutation.mutate(val)}
                  trackColor={{ false: '#CBD5E1', true: colors.success }}
                />
              </View>
            </Card>

            {/* Chi tiết liên hệ quán */}
            <Card style={styles.infoCard}>
              <Text style={styles.cardTitle}>Thông tin liên hệ & Địa chỉ</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.infoVal}>{restaurant.address}</Text>
              </View>
              {restaurant.description ? (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.infoVal}>{restaurant.description}</Text>
                </View>
              ) : null}
            </Card>
          </>
        )}

        {/* Menu cài đặt tài khoản */}
        <Card style={styles.infoCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.menuLabel}>Tài khoản cá nhân & Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Nút Đăng xuất */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Chỉnh sửa thông tin quán */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa thông tin Quán</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Input
                label="Tên nhà hàng *"
                value={restName}
                onChangeText={setRestName}
                placeholder="VD: Phở Gia Truyền"
              />
              <Input
                label="Địa chỉ quán *"
                value={restAddress}
                onChangeText={setRestAddress}
                placeholder="VD: 123 Đường ABC, Quận 1..."
              />
              <Input
                label="Mô tả quán"
                value={restDescription}
                onChangeText={setRestDescription}
                placeholder="Mô tả món ăn đặc sắc..."
              />

              <Text style={styles.fieldLabel}>Ảnh bìa quán ăn:</Text>
              <View style={styles.imagePickerRow}>
                <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickCover}>
                  <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  <Text style={styles.pickImageText}>Tải ảnh từ máy</Text>
                </TouchableOpacity>
                {restImageUrl ? (
                  <Image source={{ uri: restImageUrl }} style={styles.coverPreview} />
                ) : null}
              </View>

              <Input
                label="Hoặc nhập link ảnh (URL)"
                value={restImageUrl}
                onChangeText={setRestImageUrl}
                placeholder="https://..."
              />

              <Button
                title="Lưu thông tin quán"
                onPress={handleSaveRestaurant}
                loading={updateRestaurantMutation.isPending}
                style={{ marginTop: 16 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '800', color: colors.text },
  userEmail: { fontSize: 13, color: colors.textMuted, marginVertical: 2 },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  restaurantCard: { padding: 16, marginBottom: 16 },
  restHeaderRow: { flexDirection: 'row', gap: 14 },
  restImg: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#E5E7EB' },
  restHeaderInfo: { flex: 1, justifyContent: 'center' },
  restName: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
  dot: { color: colors.textMuted },
  radiusText: { fontSize: 12, color: colors.textMuted },
  editRestBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editRestText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, maxWidth: 240 },
  infoCard: { padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoVal: { fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 32,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  imagePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pickImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pickImageText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  coverPreview: { width: 60, height: 40, borderRadius: 6 },
});
