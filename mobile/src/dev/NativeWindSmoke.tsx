import React from 'react';
import { ScrollView, Text, View } from 'react-native';

// Màn thử Giai đoạn 2: chứng minh className hoạt động (nền, chữ, bo góc, khoảng cách, bóng, font).
export const NativeWindSmoke: React.FC = () => (
  <ScrollView className="flex-1 bg-canvas-subtle" contentContainerClassName="p-4 gap-4">
    <View className="rounded-lg bg-surface p-4 shadow-card">
      <Text className="font-body-bold text-title text-ink">Đường Dương Quảng Hàm</Text>
      <Text className="mt-1 font-body text-body text-ink-secondary">
        Phở bò tái nạm, cà phê muối, bánh xèo giòn rụm – ỷ ỵ ữ ự ẫ ẩ ₫
      </Text>
    </View>
    <View className="flex-row gap-3">
      <View className="h-button-lg flex-1 items-center justify-center rounded-full bg-brand-500 shadow-glow">
        <Text className="font-body-semibold text-body-lg text-ink-inverse">Nút chính</Text>
      </View>
      <View className="rounded-sm bg-accent-500 px-3 py-1 self-center">
        <Text className="font-body-semibold text-caption text-ink-inverse">Giảm 30%</Text>
      </View>
    </View>
    <View className="rounded-2xl bg-brand-900 p-6 shadow-float">
      <Text className="font-body-medium text-headline text-ink-inverse">Bóng float, bo 2xl</Text>
    </View>
  </ScrollView>
);
