import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { MenuItem } from '../../types/api';
import { formatVND } from '../../utils/format';

export const OwnerMenuScreen: React.FC = () => {
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form states cho thêm / sửa món
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState('');

  // Form states cho thêm danh mục
  const [catName, setCatName] = useState('');

  // 1. Lấy quán
  const { data: restaurants, isLoading: loadingRest } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });

  const restaurant = restaurants?.[0];

  // 2. Lấy chi tiết thực đơn quán
  const {
    data: detail,
    isLoading: loadingDetail,
    refetch,
  } = useQuery({
    queryKey: ['owner', 'menu', restaurant?.id],
    queryFn: () => (restaurant ? restaurantsApi.getDetail(restaurant.id) : null),
    enabled: Boolean(restaurant?.id),
  });

  // Mutation: Thêm món
  const createItemMutation = useMutation({
    mutationFn: (data: any) => restaurantsApi.createMenuItem(restaurant!.id, data),
    onSuccess: () => {
      refetch();
      setItemModalVisible(false);
      resetItemForm();
      Alert.alert('Thành công', 'Đã thêm món ăn mới!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể tạo món mới');
    },
  });

  // Mutation: Cập nhật món
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      restaurantsApi.updateMenuItem(id, data),
    onSuccess: () => {
      refetch();
      setEditModalVisible(false);
      setEditingItem(null);
      resetItemForm();
      Alert.alert('Thành công', 'Đã cập nhật món ăn thành công!');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật món ăn');
    },
  });

  // Mutation: Bật/Tắt còn hàng
  const toggleAvailableMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      restaurantsApi.updateMenuItem(id, { isAvailable }),
    onSuccess: () => refetch(),
  });

  // Mutation: Xóa món
  const archiveItemMutation = useMutation({
    mutationFn: (id: string) => restaurantsApi.archiveMenuItem(id),
    onSuccess: () => {
      refetch();
      if (editModalVisible) {
        setEditModalVisible(false);
        setEditingItem(null);
      }
    },
  });

  // Mutation: Thêm danh mục
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => restaurantsApi.createCategory(restaurant!.id, data),
    onSuccess: () => {
      refetch();
      setCatModalVisible(false);
      setCatName('');
    },
    onError: (err: any) => {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể tạo danh mục');
    },
  });

  const resetItemForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setSelectedCatId(undefined);
    setImageUrl('');
  };

  // Chọn ảnh từ thiết bị
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập ảnh để chọn hình món ăn.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setImageUrl(uri);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thiết bị');
    }
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(String(item.price));
    setDescription(item.description || '');
    setSelectedCatId(item.categoryId || undefined);
    setImageUrl(item.imageUrl || '');
    setEditModalVisible(true);
  };

  const handleSaveItem = () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên món và giá bán');
      return;
    }
    const numPrice = parseInt(price.replace(/\D/g, ''), 10);
    if (isNaN(numPrice) || numPrice < 1000) {
      Alert.alert('Giá không hợp lệ', 'Giá món tối thiểu là 1.000 VNĐ');
      return;
    }

    if (editingItem) {
      updateItemMutation.mutate({
        id: editingItem.id,
        data: {
          name: name.trim(),
          price: numPrice,
          description: description.trim() || undefined,
          categoryId: selectedCatId || undefined,
          imageUrl: imageUrl.trim() || undefined,
        },
      });
    } else {
      createItemMutation.mutate({
        name: name.trim(),
        price: numPrice,
        description: description.trim() || undefined,
        categoryId: selectedCatId || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    }
  };

  const handleDeleteItem = (item: MenuItem) => {
    Alert.alert('Xoá món ăn', `Bạn có chắc muốn xoá món "${item.name}" khỏi thực đơn?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xoá món', style: 'destructive', onPress: () => archiveItemMutation.mutate(item.id) },
    ]);
  };

  if (loadingRest || loadingDetail) {
    return <LoadingSpinner message="Đang tải thực đơn quán..." />;
  }

  if (!restaurant || !detail) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState title="Chưa có dữ liệu nhà hàng" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý Thực đơn & Món</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.addCatBtn} onPress={() => setCatModalVisible(true)}>
            <Ionicons name="folder-outline" size={16} color={colors.primary} />
            <Text style={styles.addCatText}>+ Nhóm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={() => {
              resetItemForm();
              setEditingItem(null);
              setItemModalVisible(true);
            }}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addItemText}>+ Món mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Danh sách các nhóm danh mục */}
        {detail.categories?.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
              <Text style={styles.categoryTitle}>{category.name}</Text>
              <Text style={styles.itemCount}>({category.menuItems?.length || 0} món)</Text>
            </View>

            {category.menuItems?.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemInfo}
                  onPress={() => handleOpenEdit(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemRow}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>{formatVND(item.price)}</Text>
                      {item.description ? (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.itemActions}>
                  <View style={styles.switchCol}>
                    <Text style={styles.switchLabel}>{item.isAvailable ? 'Còn món' : 'Hết'}</Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={(val) =>
                        toggleAvailableMutation.mutate({ id: item.id, isAvailable: val })
                      }
                      trackColor={{ false: '#CBD5E1', true: colors.primary }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        ))}

        {/* Các món chưa phân loại */}
        {detail.uncategorizedItems && detail.uncategorizedItems.length > 0 && (
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons name="help-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.categoryTitle}>Chưa phân nhóm</Text>
              <Text style={styles.itemCount}>({detail.uncategorizedItems.length} món)</Text>
            </View>

            {detail.uncategorizedItems.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemInfo}
                  onPress={() => handleOpenEdit(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemRow}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>{formatVND(item.price)}</Text>
                      {item.description ? (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.itemActions}>
                  <View style={styles.switchCol}>
                    <Text style={styles.switchLabel}>{item.isAvailable ? 'Còn món' : 'Hết'}</Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={(val) =>
                        toggleAvailableMutation.mutate({ id: item.id, isAvailable: val })
                      }
                      trackColor={{ false: '#CBD5E1', true: colors.primary }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal: Thêm hoặc Sửa món ăn (Xử lý bàn phím chuẩn không bị che) */}
      <Modal
        visible={itemModalVisible || editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setItemModalVisible(false);
          setEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setItemModalVisible(false);
                  setEditModalVisible(false);
                  setEditingItem(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollBody}
            >
              <Input
                label="Tên món ăn *"
                placeholder="VD: Bún chả đặc biệt"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Giá bán (VNĐ) *"
                placeholder="VD: 55000"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <Input
                label="Mô tả món ăn"
                placeholder="VD: Thịt nướng than hoa thơm lừng"
                value={description}
                onChangeText={setDescription}
              />

              {/* Upload ảnh từ thiết bị hoặc nhập URL */}
              <Text style={styles.fieldLabel}>Hình ảnh món ăn:</Text>
              <View style={styles.imagePickerRow}>
                <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickImage}>
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={styles.pickImageText}>Chọn từ máy</Text>
                </TouchableOpacity>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                ) : null}
              </View>

              <Input
                label="Hoặc nhập Link ảnh (URL)"
                placeholder="https://..."
                value={imageUrl}
                onChangeText={setImageUrl}
              />

              {/* Chọn danh mục */}
              <Text style={styles.fieldLabel}>Chọn nhóm món ăn:</Text>
              <View style={styles.catChipsList}>
                {detail.categories?.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catSelectChip,
                      selectedCatId === cat.id && styles.catSelectChipActive,
                    ]}
                    onPress={() =>
                      setSelectedCatId(selectedCatId === cat.id ? undefined : cat.id)
                    }
                  >
                    <Text
                      style={[
                        styles.catSelectText,
                        selectedCatId === cat.id && styles.catSelectTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title={editingItem ? 'Lưu thay đổi' : 'Tạo món ăn'}
                onPress={handleSaveItem}
                loading={createItemMutation.isPending || updateItemMutation.isPending}
                style={{ marginTop: 16 }}
              />

              {editingItem && (
                <Button
                  title="Xoá món ăn này"
                  variant="outline"
                  onPress={() => handleDeleteItem(editingItem)}
                  style={{ marginTop: 10, borderColor: colors.danger }}
                  textStyle={{ color: colors.danger }}
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Thêm danh mục mới */}
      <Modal visible={catModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo nhóm món mới</Text>
              <TouchableOpacity
                onPress={() => setCatModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Input
              label="Tên nhóm danh mục"
              placeholder="VD: Món Tráng Miệng, Lẩu..."
              value={catName}
              onChangeText={setCatName}
            />

            <Button
              title="Tạo nhóm"
              onPress={() =>
                catName.trim() && createCategoryMutation.mutate({ name: catName.trim() })
              }
              loading={createCategoryMutation.isPending}
              style={{ marginTop: 16 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerButtons: { flexDirection: 'row', gap: 8 },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addCatText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  addItemText: { fontSize: 13, fontWeight: '700', color: colors.white },
  scroll: { padding: 16, paddingBottom: 40 },
  categorySection: { marginBottom: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  categoryTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  itemCount: { fontSize: 13, color: colors.textMuted },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemThumb: { width: 50, height: 50, borderRadius: 6, backgroundColor: '#E5E7EB' },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  itemDesc: { fontSize: 12, color: colors.textMuted },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchCol: { alignItems: 'center' },
  switchLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 2 },
  deleteBtn: { padding: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: Platform.OS === 'ios' ? '80%' : '90%',
    flexShrink: 1,
  },
  modalScrollBody: {
    paddingBottom: 220,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  pickImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pickImageText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  imagePreview: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  catChipsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  catSelectChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catSelectText: { fontSize: 13, color: colors.textSecondary },
  catSelectTextActive: { color: colors.white, fontWeight: '700' },
});
