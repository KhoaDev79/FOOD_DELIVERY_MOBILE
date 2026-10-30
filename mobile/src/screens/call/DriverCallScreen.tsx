import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/ui';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverCall'>;

export const DriverCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const driverName = route.params?.driverName || 'Tài xế giao hàng';
  const driverPhone = route.params?.driverPhone || '0908 123 456';

  const [callSeconds, setCallSeconds] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Bộ đếm thời gian cuộc gọi chạy liên tục
  useEffect(() => {
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEndCall = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 justify-between bg-canvas-subtle py-10">
      {/* Thông tin đầu trang */}
      <View className="mt-5 items-center">
        <Text variant="display" weight="bold" className="mb-1 text-center">
          {driverName}
        </Text>
        <Text variant="body" tone="secondary" className="mb-3 text-center">
          {driverPhone}
        </Text>
        <Text variant="title" weight="semibold" tone="brand">
          {formatTimer(callSeconds)}
        </Text>
      </View>

      {/* Avatar tròn lớn ở giữa */}
      <View className="items-center justify-center">
        <View className="h-48 w-48 items-center justify-center rounded-full bg-brand-50">
          <View className="h-40 w-40 items-center justify-center rounded-full bg-brand-100">
            <View className="h-32 w-32 items-center justify-center rounded-full bg-brand-500 shadow-raised">
              <Ionicons name="person" size={72} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      {/* Cụm điều khiển phía dưới */}
      <View className="items-center gap-9 pb-6">
        <View className="flex-row justify-center gap-14">
          <Pressable
            className={`h-18 w-18 items-center justify-center rounded-full border shadow-card active:opacity-70 ${
              isSpeakerOn ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'
            }`}
            onPress={() => setIsSpeakerOn(!isSpeakerOn)}
          >
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
              size={28}
              color={isSpeakerOn ? '#1EB9CE' : '#1A1A1A'}
            />
            <Text
              variant="micro"
              weight="semibold"
              className={isSpeakerOn ? 'text-brand-600' : 'text-ink-secondary'}
            >
              Loa ngoài
            </Text>
          </Pressable>

          <Pressable
            className={`h-18 w-18 items-center justify-center rounded-full border shadow-card active:opacity-70 ${
              isMuted ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'
            }`}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic-outline'}
              size={28}
              color={isMuted ? '#1EB9CE' : '#1A1A1A'}
            />
            <Text
              variant="micro"
              weight="semibold"
              className={isMuted ? 'text-brand-600' : 'text-ink-secondary'}
            >
              Tắt tiếng
            </Text>
          </Pressable>
        </View>

        {/* Nút cúp máy màu đỏ lớn */}
        <Pressable
          className="h-18 w-18 items-center justify-center rounded-full bg-danger shadow-raised active:opacity-80"
          onPress={handleEndCall}
        >
          <View className="rotate-[135deg]">
            <Ionicons name="call" size={32} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
