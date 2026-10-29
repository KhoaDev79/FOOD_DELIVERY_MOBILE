import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useRestaurantDetail } from '../../services/useRestaurants';
import { useCartStore } from '../../store/useCartStore';
import { MenuItem } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'RestaurantDetail'>;

interface CustomizationState {
  size: 'S' | 'M' | 'L';
  toppings: string[];
  spiciness: 'Không cay' | 'Cay vừa' | 'Rất cay';
  quantity: number;
  note: string;
}

const SIZE_OPTIONS: { key: 'S' | 'M' | 'L'; label: string; price: number }[] = [
  { key: 'S', label: 'Size Nhỏ (S)', price: 0 },
  { key: 'M', label: 'Size Vừa (M)', price: 10000 },
  { key: 'L', label: 'Size Lớn (L)', price: 20000 },
];

const TOPPING_OPTIONS: { id: string; label: string; price: number }[] = [
  { id: 't1', label: 'Bắp ngọt sốt bơ', price: 5000 },
  { id: 't2', label: 'Phô mai Cheddar béo ngậy', price: 10000 },
  { id: 't3', label: 'Sốt trứng muối hoàng kim', price: 12000 },
  { id: 't4', label: 'Thêm xúc xích nướng', price: 15000 },
];

const SPICINESS_OPTIONS: ('Không cay' | 'Cay vừa' | 'Rất cay')[] = [
  'Không cay',
  'Cay vừa',
  'Rất cay',
];

export const RestaurantDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { restaurantId } = route.params;
  const { data: restaurant, isLoading } = useRestaurantDetail(restaurantId);

  const addCustomItem = useCartStore((s) => s.addCustomItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartTotalItems = useCartStore((s) => s.getTotalItems());
  const cartSubtotal = useCartStore((s) => s.getSubtotal());

  // Customization modal state (Trang 5)
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [customState, setCustomState] = useState<CustomizationState>({
    size: 'M',
    toppings: [],
    spiciness: 'Không cay',
    quantity: 1,
    note: '',
  });

  const [isFavorite, setIsFavorite] = useState(false);

  const handleOpenCustomize = (item: MenuItem) => {
    setSelectedDish(item);
    setCustomState({
      size: 'M',
      toppings: [],
      spiciness: 'Không cay',
      quantity: 1,
      note: '',
    });
  };

  const calculateItemPrice = () => {
    if (!selectedDish) return 0;
    const base = selectedDish.price;
    const sizeAdd = SIZE_OPTIONS.find((s) => s.key === customState.size)?.price || 0;
    const toppingAdd = customState.toppings.reduce((sum, tid) => {
      const top = TOPPING_OPTIONS.find((t) => t.id === tid);
      return sum + (top?.price || 0);
    }, 0);
    return (base + sizeAdd + toppingAdd) * customState.quantity;
  };

  const handleAddToCart = () => {
    if (!restaurant || !selectedDish) return;

    const unitPrice = calculateItemPrice() / customState.quantity;
    const selectedToppingLabels = customState.toppings
      .map((tid) => TOPPING_OPTIONS.find((t) => t.id === tid)?.label)
      .filter(Boolean) as string[];

    const res = addCustomItem(
      {
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurant.imageUrl,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      },
      selectedDish,
      customState.quantity,
      {
        size: customState.size,
        toppings: selectedToppingLabels,
        spiciness: customState.spiciness,
        unitPrice,
        note: customState.note.trim() || undefined,
      },
    );

    if (res === 'DIFFERENT_RESTAURANT') {
      Alert.alert(
        'Tạo giỏ hàng mới?',
        'Giỏ hàng của bạn đang có món của nhà hàng khác. Bạn có muốn xóa giỏ cũ để thêm món của quán này?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Tạo giỏ mới',
            style: 'destructive',
            onPress: () => {
              clearCart();
              addCustomItem(
                {
                  id: restaurant.id,
                  name: restaurant.name,
                  imageUrl: restaurant.imageUrl,
                  latitude: restaurant.latitude,
                  longitude: restaurant.longitude,
                },
                selectedDish,
                customState.quantity,
                {
                  size: customState.size,
                  toppings: selectedToppingLabels,
                  spiciness: customState.spiciness,
                  unitPrice,
                  note: customState.note.trim() || undefined,
                },
              );
              setSelectedDish(null);
            },
          },
        ],
      );
    } else {
      setSelectedDish(null);
    }
  };

  const toggleTopping = (id: string) => {
    setCustomState((prev) => {
      const exists = prev.toppings.includes(id);
      return {
        ...prev,
        toppings: exists ? prev.toppings.filter((t) => t !== id) : [...prev.toppings, id],
      };
    });
  };

  if (isLoading || !restaurant) {
    return <LoadingSpinner message="Đang tải thực đơn quán..." />;
  }

  // Danh sách các món nổi bật
  const allDishes = [
    ...(restaurant.categories?.flatMap((c) => c.menuItems || []) || []),
    ...(restaurant.uncategorizedItems || []),
  ];
  const featuredDishes = allDishes.slice(0, 4);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover Banner (Trang 4) */}
        <View style={styles.bannerContainer}>
          <Image
            source={{
              uri:
                restaurant.imageUrl ||
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
            }}
            style={styles.bannerImage}
          />
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favButton}
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#EE4D2D' : colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Thẻ thông tin nổi ShopeeFood / UI Thầy (Trang 4) */}
        <View style={styles.floatingHeaderCard}>
          <View style={styles.badgeRow}>
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeOrangeText}>Deal 1K</Text>
            </View>
            <View style={styles.badgeLight}>
              <Text style={styles.badgeLightText}>Gần bạn</Text>
            </View>
          </View>

          <Text style={styles.restaurantTitle}>{restaurant.name}</Text>

          <View style={styles.infoMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#EE4D2D" />
              <Text style={styles.metaText}>06:00 - 22:00</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#EE4D2D" />
              <Text style={styles.metaText}>Bán kính {restaurant.deliveryRadiusKm} km</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.metaItem}>
              <Ionicons name="pricetag-outline" size={14} color="#EE4D2D" />
              <Text style={styles.metaText}>35k - 120k</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Quick Clickable Links (Trang 4) */}
          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() =>
              navigation.navigate('Rating', {
                orderId: 'rest-rating',
                restaurantName: restaurant.name,
              })
            }
          >
            <View style={styles.quickLinkLeft}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.quickLinkMainText}>
                {restaurant.rating.toFixed(1)} (289 lượt đánh giá của khách)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() => navigation.navigate('VoucherSelect', {})}
          >
            <View style={styles.quickLinkLeft}>
              <Ionicons name="ticket-outline" size={16} color="#EE4D2D" />
              <Text style={styles.quickLinkMainText}>4 mã ưu đãi giảm tới 30.000đ</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.quickLinkRow}>
            <View style={styles.quickLinkLeft}>
              <Ionicons name="bicycle-outline" size={16} color="#10B981" />
              <Text style={styles.quickLinkMainText}>Giao nhanh 15 - 25 phút</Text>
            </View>
            <Text style={styles.freeshipBadge}>Freeship</Text>
          </View>
        </View>

        {/* Mục Dành cho bạn (For you) - Lưới 2 cột theo Trang 4 */}
        {featuredDishes.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Món ăn gợi ý</Text>
              <Text style={styles.sectionSubtitle}>Dành riêng cho bạn</Text>
            </View>

            <View style={styles.gridContainer}>
              {featuredDishes.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridCard}
                  activeOpacity={0.8}
                  onPress={() => handleOpenCustomize(item)}
                >
                  <Image
                    source={{
                      uri:
                        item.imageUrl ||
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
                    }}
                    style={styles.gridImage}
                  />
                  <View style={styles.gridBody}>
                    <Text style={styles.gridName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.gridRating}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.gridRatingText}>4.9 (99+)</Text>
                    </View>
                    <View style={styles.gridBottomRow}>
                      <Text style={styles.gridPrice}>{formatVND(item.price)}</Text>
                      <View style={styles.addMiniBtn}>
                        <Ionicons name="add" size={16} color={colors.white} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Danh sách danh mục & món ăn chính */}
        <View style={styles.menuContainer}>
          <Text style={styles.mainMenuHeading}>Thực đơn quán</Text>

          {restaurant.categories?.map((cat) => (
            <View key={cat.id} style={styles.categorySection}>
              <Text style={styles.categoryName}>📁 {cat.name}</Text>
              {cat.menuItems?.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItemCard}
                  activeOpacity={0.8}
                  onPress={() => handleOpenCustomize(item)}
                >
                  <Image
                    source={{
                      uri:
                        item.imageUrl ||
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
                    }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View style={styles.itemFooter}>
                      <Text style={styles.itemPrice}>{formatVND(item.price)}</Text>
                      <View style={styles.addCircleBtn}>
                        <Ionicons name="add" size={18} color={colors.white} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {restaurant.uncategorizedItems && restaurant.uncategorizedItems.length > 0 && (
            <View style={styles.categorySection}>
              <Text style={styles.categoryName}>📁 Món khác</Text>
              {restaurant.uncategorizedItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItemCard}
                  activeOpacity={0.8}
                  onPress={() => handleOpenCustomize(item)}
                >
                  <Image
                    source={{
                      uri:
                        item.imageUrl ||
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
                    }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View style={styles.itemFooter}>
                      <Text style={styles.itemPrice}>{formatVND(item.price)}</Text>
                      <View style={styles.addCircleBtn}>
                        <Ionicons name="add" size={18} color={colors.white} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Thanh Giỏ Hàng nổi dưới cùng */}
      {cartTotalItems > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.floatingBadge}>
              <Text style={styles.floatingBadgeText}>{cartTotalItems}</Text>
            </View>
            <Text style={styles.floatingCartText}>Xem giỏ hàng</Text>
          </View>
          <Text style={styles.floatingPrice}>{formatVND(cartSubtotal)}</Text>
        </TouchableOpacity>
      )}

      {/* Modal Tuỳ biến món ăn chuẩn Trang 5 (Size, Topping, Spiciness) */}
      <Modal
        visible={Boolean(selectedDish)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDish(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.customModalContainer}>
            {/* Header Modal kèm ảnh */}
            <View style={styles.customHeader}>
              <Image
                source={{
                  uri:
                    selectedDish?.imageUrl ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
                }}
                style={styles.customDishImage}
              />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedDish(null)}
              >
                <Ionicons name="close" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.customScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Tiêu đề & giá cơ bản */}
              <View style={styles.dishSummary}>
                <Text style={styles.customDishName}>{selectedDish?.name}</Text>
                <Text style={styles.customDishPrice}>{formatVND(selectedDish?.price || 0)}</Text>
                {selectedDish?.description ? (
                  <Text style={styles.customDishDesc}>{selectedDish.description}</Text>
                ) : null}
              </View>

              <View style={styles.divider} />

              {/* 1. Chọn Size (Pick 1) */}
              <View style={styles.optionSection}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>Chọn kích thước (Size)</Text>
                  <Text style={styles.requiredTag}>Bắt buộc</Text>
                </View>

                {SIZE_OPTIONS.map((opt) => {
                  const isSelected = customState.size === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.radioRow, isSelected && styles.radioRowActive]}
                      onPress={() => setCustomState({ ...customState, size: opt.key })}
                    >
                      <View style={styles.radioLeft}>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#EE4D2D' : colors.textMuted}
                        />
                        <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>
                          {opt.label}
                        </Text>
                      </View>
                      <Text style={styles.addPriceText}>
                        {opt.price > 0 ? `+${formatVND(opt.price)}` : 'Gốc'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* 2. Chọn Topping (Optional) */}
              <View style={styles.optionSection}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>Thêm Topping đặc sắc</Text>
                  <Text style={styles.optionalTag}>Tùy chọn</Text>
                </View>

                {TOPPING_OPTIONS.map((top) => {
                  const isChecked = customState.toppings.includes(top.id);
                  return (
                    <TouchableOpacity
                      key={top.id}
                      style={[styles.radioRow, isChecked && styles.radioRowActive]}
                      onPress={() => toggleTopping(top.id)}
                    >
                      <View style={styles.radioLeft}>
                        <Ionicons
                          name={isChecked ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isChecked ? '#EE4D2D' : colors.textMuted}
                        />
                        <Text style={[styles.radioText, isChecked && styles.radioTextActive]}>
                          {top.label}
                        </Text>
                      </View>
                      <Text style={styles.addPriceText}>+{formatVND(top.price)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* 3. Độ cay (Pick 1) */}
              <View style={styles.optionSection}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>Mức độ cay</Text>
                  <Text style={styles.requiredTag}>Chọn 1</Text>
                </View>

                <View style={styles.chipsRow}>
                  {SPICINESS_OPTIONS.map((sp) => {
                    const isSelected = customState.spiciness === sp;
                    return (
                      <TouchableOpacity
                        key={sp}
                        style={[styles.spiceChip, isSelected && styles.spiceChipActive]}
                        onPress={() => setCustomState({ ...customState, spiciness: sp })}
                      >
                        <Text
                          style={[styles.spiceText, isSelected && styles.spiceTextActive]}
                        >
                          {sp}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.divider} />

              {/* Ghi chú cho quán */}
              <View style={styles.optionSection}>
                <Text style={styles.optionTitle}>Ghi chú cho quán</Text>
                <TextInput
                  placeholder="Ví dụ: Ít đường, không hành, tương ớt để riêng..."
                  placeholderTextColor={colors.textMuted}
                  value={customState.note}
                  onChangeText={(t) => setCustomState({ ...customState, note: t })}
                  style={styles.noteInput}
                />
              </View>
            </ScrollView>

            {/* Bottom Bar: Stepper & Add to cart button */}
            <View style={styles.customBottomBar}>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setCustomState((prev) => ({
                      ...prev,
                      quantity: Math.max(1, prev.quantity - 1),
                    }))
                  }
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperCount}>{customState.quantity}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setCustomState((prev) => ({
                      ...prev,
                      quantity: prev.quantity + 1,
                    }))
                  }
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={handleAddToCart}
                activeOpacity={0.8}
              >
                <Text style={styles.addToCartText}>
                  Thêm vào giỏ • {formatVND(calculateItemPrice())}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 110 },
  bannerContainer: { position: 'relative', height: 220 },
  bannerImage: { width: '100%', height: '100%', backgroundColor: colors.borderLight },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  favButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  floatingHeaderCard: {
    marginHorizontal: 16,
    marginTop: -30,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badgeOrange: {
    backgroundColor: '#FFF0ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOrangeText: { color: '#EE4D2D', fontSize: 11, fontWeight: '700' },
  badgeLight: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeLightText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  restaurantTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  infoMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  dot: { color: colors.textMuted },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  quickLinkLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  quickLinkMainText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  freeshipBadge: {
    backgroundColor: '#ECFDF5',
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  gridImage: { width: '100%', height: 110, backgroundColor: '#E5E7EB' },
  gridBody: { padding: 10 },
  gridName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  gridRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  gridRatingText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  gridBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridPrice: { fontSize: 14, fontWeight: '800', color: '#EE4D2D' },
  addMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: { marginTop: 24, paddingHorizontal: 16 },
  mainMenuHeading: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 14 },
  categorySection: { marginBottom: 20 },
  categoryName: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginBottom: 10 },
  menuItemCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    gap: 12,
  },
  itemImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#E5E7EB' },
  itemDetails: { flex: 1, justifyContent: 'space-between' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#EE4D2D' },
  addCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCart: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#EE4D2D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatingBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  floatingBadgeText: { color: '#EE4D2D', fontWeight: '800', fontSize: 13 },
  floatingCartText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  floatingPrice: { color: colors.white, fontSize: 16, fontWeight: '800' },
  // Modal customization styles (Trang 5)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  customModalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  customHeader: { position: 'relative', height: 180 },
  customDishImage: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customScroll: { padding: 20, paddingBottom: 30 },
  dishSummary: { marginBottom: 4 },
  customDishName: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  customDishPrice: { fontSize: 18, fontWeight: '800', color: '#EE4D2D', marginBottom: 6 },
  customDishDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  optionSection: { marginVertical: 6 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  requiredTag: { fontSize: 11, color: '#EE4D2D', fontWeight: '700', backgroundColor: '#FFF0ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  optionalTag: { fontSize: 11, color: colors.textMuted, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  radioRowActive: { backgroundColor: '#FFF9F8' },
  radioLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  radioTextActive: { color: '#EE4D2D', fontWeight: '700' },
  addPriceText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', gap: 10 },
  spiceChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  spiceChipActive: { backgroundColor: '#FFF0ED', borderColor: '#EE4D2D' },
  spiceText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  spiceTextActive: { color: '#EE4D2D', fontWeight: '700' },
  noteInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
  },
  customBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: colors.white,
    gap: 14,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stepperBtn: { padding: 8 },
  stepperCount: { paddingHorizontal: 10, fontSize: 15, fontWeight: '700', color: colors.text },
  addToCartBtn: {
    flex: 1,
    backgroundColor: '#EE4D2D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
