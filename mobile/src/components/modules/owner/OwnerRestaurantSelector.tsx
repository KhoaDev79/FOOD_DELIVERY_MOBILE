import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useOwnerRestaurantStore } from '../../../store/useOwnerRestaurantStore';
import { Restaurant } from '../../../types/api';
import { AppImage, Icon, Text, useToast } from '../../ui';

interface OwnerRestaurantSelectorProps {
  restaurants?: Restaurant[];
  currentRestaurant: Restaurant;
}

export const OwnerRestaurantSelector: React.FC<OwnerRestaurantSelectorProps> = ({
  restaurants = [],
  currentRestaurant,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const setSelectedRestaurantId = useOwnerRestaurantStore((s) => s.setSelectedRestaurantId);
  const toast = useToast();

  const hasMultiple = restaurants.length > 1;

  const handleSelect = (r: Restaurant) => {
    setSelectedRestaurantId(r.id);
    setModalVisible(false);
    toast(`Đã chuyển sang quản lý quán: ${r.name}`, 'success');
  };

  return (
    <>
      {/* Nút bấm hiển thị tên quán & mở danh sách đổi quán */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Đang chọn quán ${currentRestaurant.name}.${hasMultiple ? ' Bấm để đổi quán' : ''}`}
        onPress={() => hasMultiple && setModalVisible(true)}
        disabled={!hasMultiple}
        className="flex-row items-center gap-1.5 self-start rounded-full bg-white/20 px-3 py-1 active:bg-white/30"
      >
        <Icon name="storefront" size={14} tone="inverse" />
        <Text variant="body" weight="bold" tone="inverse" numberOfLines={1} className="max-w-[180px]">
          {currentRestaurant.name}
        </Text>

        {hasMultiple && (
          <View className="flex-row items-center gap-1 pl-1">
            <View className="rounded-full bg-amber-400 px-1.5 py-0.5 shadow-sm">
              <Text variant="micro" weight="bold" className="text-stone-900 text-[10px]">
                {restaurants.length} quán
              </Text>
            </View>
            <Icon name="chevron-down" size={14} tone="inverse" />
          </View>
        )}
      </Pressable>

      {/* Modal danh sách tất cả các quán thuộc quyền quản lý */}
      {hasMultiple && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/65 px-4">
            {/* Chạm nền để đóng */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng danh sách quán"
              onPress={() => setModalVisible(false)}
              className="absolute inset-0"
            />

            {/* Khung nội dung danh sách quán */}
            <View className="relative w-full max-w-[360px] overflow-hidden rounded-3xl bg-surface p-5 shadow-2xl" style={styles.modalCard}>
              {/* Tiêu đề & nút đóng */}
              <View className="flex-row items-center justify-between pb-3 border-b border-line">
                <View className="flex-1">
                  <Text variant="headline" weight="bold">
                    Chọn quán quản lý
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Tài khoản của bạn sở hữu {restaurants.length} quán ăn
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                  onPress={() => setModalVisible(false)}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-full bg-canvas-subtle active:opacity-70"
                >
                  <Icon name="close" size={18} tone="secondary" />
                </Pressable>
              </View>

              {/* Danh sách cuộn các quán */}
              <ScrollView
                className="mt-3 max-h-[380px]"
                showsVerticalScrollIndicator={false}
                contentContainerClassName="gap-2.5 pb-2"
              >
                {restaurants.map((item) => {
                  const isSelected = item.id === currentRestaurant.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Chọn quán ${item.name}`}
                      onPress={() => handleSelect(item)}
                      className={`flex-row items-center gap-3 rounded-2xl p-3 border transition-colors ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/70 shadow-sm active:bg-brand-50'
                          : 'border-line bg-surface shadow-none active:bg-canvas-subtle'
                      }`}
                    >
                      {/* Ảnh đại diện quán */}
                      <View className="h-12 w-12 overflow-hidden rounded-xl bg-canvas-subtle">
                        <AppImage
                          uri={item.imageUrl}
                          className="h-full w-full"
                          fallbackIcon="storefront-outline"
                        />
                      </View>

                      {/* Thông tin quán */}
                      <View className="flex-1 gap-0.5">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            variant="body"
                            weight={isSelected ? 'bold' : 'medium'}
                            numberOfLines={1}
                            className={isSelected ? 'text-brand-700' : 'text-ink'}
                          >
                            {item.name}
                          </Text>
                        </View>

                        <Text variant="caption" tone="secondary" numberOfLines={1}>
                          {item.address}
                        </Text>

                        {/* Trạng thái mở/đóng */}
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <View
                            className={`h-2 w-2 rounded-full ${
                              item.acceptingOrders
                                ? 'bg-success'
                                : item.isOpen
                                ? 'bg-warning'
                                : 'bg-danger'
                            }`}
                          />
                          <Text variant="micro" tone="muted">
                            {item.acceptingOrders
                              ? 'Đang nhận đơn'
                              : item.isOpen
                              ? 'Ngoài giờ mở cửa'
                              : 'Đã đóng cửa'}
                          </Text>
                        </View>
                      </View>

                      {/* Icon đánh dấu đang chọn */}
                      {isSelected ? (
                        <Icon name="checkmark-circle" size={22} tone="brand" />
                      ) : (
                        <View className="h-5 w-5 rounded-full border border-line-subtle" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalCard: {
    elevation: 20,
  },
});

