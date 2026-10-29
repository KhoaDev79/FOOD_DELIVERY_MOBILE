import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi, AdminRestaurantItem } from '../../api/admin';
import { restaurantsApi } from '../../api/restaurants';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../constants/config';
import { formatVND } from '../../utils/format';

export const AdminRestaurantsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal tạo quán mới
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Modal chỉnh sửa quán
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRest, setEditingRest] = useState<AdminRestaurantItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Modal xem thực đơn quán
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [selectedRestForMenu, setSelectedRestForMenu] = useState<AdminRestaurantItem | null>(null);

  // Lấy danh sách quán ăn
  const {
    data: restaurantsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'restaurants', searchQuery],
    queryFn: () =>
      adminApi.listRestaurants({
        q: searchQuery.trim() || undefined,
        limit: 50,
      }),
  });

  // Lấy chi tiết thực đơn khi mở modal thực đơn
  const {
    data: restaurantDetail,
    isLoading: loadingMenu,
    refetch: refetchMenu,
  } = useQuery({
    queryKey: ['admin', 'restaurant_menu', selectedRestForMenu?.id],
    queryFn: () => (selectedRestForMenu ? restaurantsApi.getDetail(selectedRestForMenu.id) : null),
    enabled: Boolean(selectedRestForMenu?.id),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Mutation tạo quán mới kèm thông tin chủ quán
  const createRestaurantMutation = useMutation({
    mutationFn: (data: any) => adminApi.createRestaurant(data),
    onSuccess: (newRest) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setCreateModalVisible(false);
      setName('');
      setAddress('');
      setPhone('');
      setOwnerName('');
      setOwnerPhone('');
      setOwnerEmail('');
      setImageUrl('');
      Alert.alert('Thành công', `Nhà hàng "${newRest.name}" và tài khoản chủ quán đã được tạo!`);
    },
    onError: (err: any) => {
      Alert.alert('Lỗi tạo quán', err.response?.data?.message || 'Không thể tạo nhà hàng.');
    },
  });

  // Mutation cập nhật thông tin quán
  const updateRestaurantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateRestaurant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setEditModalVisible(false);
      setEditingRest(null);
      Alert.alert('Thành công', 'Đã cập nhật thông tin quán thành công!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật.');
    },
  });

  // Mutation xoá quán ăn
  const deleteRestaurantMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteRestaurant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      Alert.alert('Thành công', 'Đã xoá quán ăn khỏi hệ thống!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xoá quán ăn này.');
    },
  });

  // Mutation xoá món ăn từ quyền Admin
  const deleteMenuItemMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteMenuItem(id),
    onSuccess: () => {
      refetchMenu();
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      Alert.alert('Thành công', 'Đã xoá món ăn vi phạm khỏi thực đơn!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xoá món ăn.');
    },
  });

  // Mutation toggle trạng thái mở / đóng
  const toggleOpenMutation = useMutation({
    mutationFn: (restaurantId: string) => adminApi.toggleRestaurantOpen(restaurantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const handleCreateRestaurant = () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhà hàng.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa chỉ nhà hàng.');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên chủ quán.');
      return;
    }
    if (!ownerPhone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại chủ quán.');
      return;
    }
    if (!ownerEmail.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email chủ quán.');
      return;
    }

    createRestaurantMutation.mutate({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() || ownerPhone.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim(),
      latitude: DEFAULT_COORDS.latitude,
      longitude: DEFAULT_COORDS.longitude,
      imageUrl: imageUrl.trim() || undefined,
    });
  };

  const handleOpenEdit = (item: AdminRestaurantItem) => {
    setEditingRest(item);
    setEditName(item.name);
    setEditAddress(item.address);
    setEditPhone(item.owner?.phone || '');
    setEditImageUrl(item.imageUrl || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editingRest) return;
    if (!editName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên quán.');
      return;
    }
    updateRestaurantMutation.mutate({
      id: editingRest.id,
      data: {
        name: editName.trim(),
        address: editAddress.trim(),
        imageUrl: editImageUrl.trim() || undefined,
      },
    });
  };

  const handleDeleteRestaurant = (item: AdminRestaurantItem) => {
    Alert.alert('Xoá quán ăn', `Bạn có chắc chắn muốn xoá toàn bộ quán "${item.name}"?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá quán',
        style: 'destructive',
        onPress: () => deleteRestaurantMutation.mutate(item.id),
      },
    ]);
  };

  const renderRestaurantItem = ({ item }: { item: AdminRestaurantItem }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.restaurantName}>{item.name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.statDot}>•</Text>
              <Text style={styles.statCountText}>{item._count.menuItems} món</Text>
              <Text style={styles.statDot}>•</Text>
              <Text style={styles.statCountText}>{item._count.orders} đơn</Text>
            </View>
          </View>
          <Badge
            label={item.isOpen ? 'Đang mở' : 'Tạm đóng'}
            color={item.isOpen ? colors.success : colors.danger}
            bgColor={item.isOpen ? '#E8F5E9' : '#FFEBEE'}
          />
        </View>

        <Text style={styles.addressText} numberOfLines={2}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} /> {item.address}
        </Text>

        <View style={styles.divider} />

        {/* Thông tin chủ quán */}
        <View style={styles.ownerBox}>
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <View style={styles.ownerInfo}>
            <Text style={styles.ownerName}>Chủ quán: {item.owner?.fullName || 'Chưa có'}</Text>
            <Text style={styles.ownerEmail}>
              {item.owner?.email} {item.owner?.phone ? `• ${item.owner.phone}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Nhóm nút hành động */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => {
              setSelectedRestForMenu(item);
              setMenuModalVisible(true);
            }}
          >
            <Ionicons name="restaurant-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnTextPrimary}>Thực đơn ({item._count.menuItems})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnOutline} onPress={() => handleOpenEdit(item)}>
            <Ionicons name="pencil-outline" size={14} color={colors.text} />
            <Text style={styles.actionBtnText}>Sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => toggleOpenMutation.mutate(item.id)}
          >
            <Ionicons
              name={item.isOpen ? 'pause-circle-outline' : 'play-circle-outline'}
              size={14}
              color={item.isOpen ? colors.warning : colors.success}
            />
            <Text style={styles.actionBtnText}>{item.isOpen ? 'Đóng quán' : 'Mở lại'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: '#FEE2E2' }]}
            onPress={() => handleDeleteRestaurant(item)}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.actionBtnTextDanger}>Xoá</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const restaurants = restaurantsData?.items || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Tìm quán ăn theo tên..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>+ Thêm quán</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải danh sách quán ăn..." />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          renderItem={renderRestaurantItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Không tìm thấy nhà hàng nào"
              message="Thử tìm kiếm với từ khoá tên nhà hàng khác hoặc bấm '+ Thêm quán' để tạo mới."
              actionLabel="Làm mới"
              onAction={onRefresh}
            />
          }
        />
      )}

      {/* Modal: Admin Thêm Quán Mới kèm Thông tin Chủ Quán */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm nhà hàng mới</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.sectionSubtitle}>1. Thông tin quán ăn</Text>
              <Input
                label="Tên nhà hàng *"
                placeholder="VD: Phở Bò Gia Truyền"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Địa chỉ quán *"
                placeholder="VD: 123 Nguyễn Văn Cừ, Quận 5, TP.HCM"
                value={address}
                onChangeText={setAddress}
              />
              <Input
                label="Số điện thoại quán"
                placeholder="VD: 0283849583"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Link ảnh quán (URL)"
                placeholder="https://..."
                value={imageUrl}
                onChangeText={setImageUrl}
              />

              <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>2. Thông tin chủ quán (Bắt buộc)</Text>
              <Input
                label="Họ và tên chủ quán *"
                placeholder="VD: Nguyễn Văn Chủ"
                value={ownerName}
                onChangeText={setOwnerName}
              />
              <Input
                label="Số điện thoại chủ quán *"
                placeholder="VD: 0909123456"
                value={ownerPhone}
                onChangeText={setOwnerPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Email chủ quán *"
                placeholder="VD: owner@example.com"
                value={ownerEmail}
                onChangeText={setOwnerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title="Tạo nhà hàng & Chủ quán"
                onPress={handleCreateRestaurant}
                loading={createRestaurantMutation.isPending}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Admin Sửa Quán Ăn */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa nhà hàng</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Input
                label="Tên nhà hàng *"
                value={editName}
                onChangeText={setEditName}
              />
              <Input
                label="Địa chỉ *"
                value={editAddress}
                onChangeText={setEditAddress}
              />
              <Input
                label="Số điện thoại"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Link ảnh bìa"
                value={editImageUrl}
                onChangeText={setEditImageUrl}
              />

              <Button
                title="Lưu thay đổi"
                onPress={handleSaveEdit}
                loading={updateRestaurantMutation.isPending}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Xem & Quản lý thực đơn quán */}
      <Modal visible={menuModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Thực đơn: {selectedRestForMenu?.name}</Text>
                <Text style={styles.modalSub}>{selectedRestForMenu?.address}</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingMenu ? (
              <LoadingSpinner message="Đang tải thực đơn..." />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                {restaurantDetail?.categories?.map((cat) => (
                  <View key={cat.id} style={{ marginBottom: 16 }}>
                    <Text style={styles.menuCatTitle}>📁 {cat.name}</Text>
                    {cat.menuItems?.map((dish) => (
                      <View key={dish.id} style={styles.dishRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dishName}>{dish.name}</Text>
                          <Text style={styles.dishPrice}>{formatVND(dish.price)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteDishBtn}
                          onPress={() =>
                            Alert.alert('Xoá món', `Xoá món "${dish.name}" khỏi hệ thống?`, [
                              { text: 'Huỷ', style: 'cancel' },
                              { text: 'Xoá', style: 'destructive', onPress: () => deleteMenuItemMutation.mutate(dish.id) },
                            ])
                          }
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}

                {restaurantDetail?.uncategorizedItems?.map((dish) => (
                  <View key={dish.id} style={styles.dishRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      <Text style={styles.dishPrice}>{formatVND(dish.price)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteDishBtn}
                      onPress={() =>
                        Alert.alert('Xoá món', `Xoá món "${dish.name}" khỏi hệ thống?`, [
                          { text: 'Huỷ', style: 'cancel' },
                          { text: 'Xoá', style: 'destructive', onPress: () => deleteMenuItemMutation.mutate(dish.id) },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}

                {(!restaurantDetail?.categories?.length && !restaurantDetail?.uncategorizedItems?.length) && (
                  <Text style={styles.emptyMenuText}>Quán ăn này chưa cập nhật món ăn nào.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  listContent: { padding: 12, paddingBottom: 40 },
  card: { padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, marginRight: 8 },
  restaurantName: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
  statDot: { color: colors.textMuted },
  statCountText: { fontSize: 12, color: colors.textSecondary },
  addressText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  ownerBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 13, fontWeight: '700', color: colors.text },
  ownerEmail: { fontSize: 12, color: colors.textMuted },
  actionsGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  actionBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  actionBtnTextPrimary: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  actionBtnTextDanger: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionSubtitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  menuCatTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dishName: { fontSize: 14, fontWeight: '600', color: colors.text },
  dishPrice: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  deleteDishBtn: { padding: 6 },
  emptyMenuText: { textAlign: 'center', color: colors.textMuted, marginTop: 30, fontSize: 14 },
});
