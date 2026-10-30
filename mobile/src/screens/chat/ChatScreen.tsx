import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/ui';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  sender: 'user' | 'other';
  text?: string;
  imageUri?: string;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender: 'other',
    text: 'Dạ quán đang làm món, em đợi khoảng 5-10 phút nữa lấy rồi giao ngay cho mình nhé!',
    time: '12:03',
  },
  {
    id: 'm2',
    sender: 'user',
    text: 'Okie cảm ơn bạn nhé!',
    time: '12:04',
  },
  {
    id: 'm3',
    sender: 'user',
    text: 'Nhờ bạn dặn quán bỏ thêm muỗng đũa và tương ớt giúp mình với ạ.',
    time: '12:04',
  },
  {
    id: 'm4',
    sender: 'other',
    text: 'Dạ em vừa dặn thu ngân rồi ạ. Em đang trên đường giao tới đây!',
    time: '12:08',
  },
];

const QUICK_REPLIES = [
  'Đến nơi gọi mình nhé!',
  'Để trước cửa giúp mình',
  'Mình xuống ngay đây',
  'Xin thêm muỗng đũa',
  'Giao nhanh giúp mình với',
];

export const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const recipientName = route.params?.recipientName || 'Tài xế giao hàng';
  const recipientRole = route.params?.recipientRole || 'Đang giao đơn hàng';
  const orderId = route.params?.orderId;

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSendText = useCallback((textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Tự động phản hồi mô phỏng của tài xế sau 2 giây
    setTimeout(() => {
      const replyMsg: Message = {
        id: `msg-reply-${Date.now()}`,
        sender: 'other',
        text: 'Dạ vâng, em nhận được thông tin rồi ạ. Em đang trên đường đến đây!',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 2000);
  }, [inputText]);

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        const newMsg: Message = {
          id: `msg-img-${Date.now()}`,
          sender: 'user',
          imageUri,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleOpenCall = () => {
    navigation.navigate('DriverCall', {
      orderId: orderId || 'ord-call',
      driverName: recipientName,
      driverPhone: '0908 123 456',
    });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-canvas-subtle">
      {/* Top Header */}
      <View className="flex-row items-center border-b border-line bg-surface px-3 py-2.5">
        <Pressable onPress={() => navigation.goBack()} className="mr-1 p-2 active:opacity-70">
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>

        <View className="relative mr-2.5 h-10 w-10 items-center justify-center rounded-full bg-brand-500">
          <Text variant="body" weight="bold" tone="inverse">
            {recipientName.charAt(0).toUpperCase()}
          </Text>
          <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" />
        </View>

        <View className="flex-1">
          <Text variant="body" weight="bold" numberOfLines={1}>
            {recipientName}
          </Text>
          <Text variant="caption" tone="secondary">
            {recipientRole}
          </Text>
        </View>

        <Pressable
          onPress={handleOpenCall}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-50 active:opacity-70"
        >
          <Ionicons name="call" size={20} color="#1EB9CE" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Messages Stream */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 pb-2.5 gap-3"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isUser = item.sender === 'user';
            return (
              <View className={`flex-row items-end ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                    <Text variant="caption" weight="bold" tone="inverse">
                      {recipientName.charAt(0)}
                    </Text>
                  </View>
                )}

                <View
                  className={`max-w-[78%] rounded-2xl p-3 ${
                    isUser
                      ? 'rounded-br-sm bg-brand-500'
                      : 'rounded-bl-sm border border-line bg-surface'
                  }`}
                >
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} className="mb-1.5 h-36 w-44 rounded-lg" />
                  ) : null}
                  {item.text ? (
                    <Text
                      variant="body"
                      tone={isUser ? 'inverse' : 'default'}
                    >
                      {item.text}
                    </Text>
                  ) : null}
                  <Text
                    variant="micro"
                    tone={isUser ? 'inverse' : 'muted'}
                    className="mt-1 self-end opacity-75"
                  >
                    {item.time}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Quick Replies Carousel */}
        <View className="border-t border-line bg-surface py-2">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={QUICK_REPLIES}
            keyExtractor={(_, idx) => String(idx)}
            contentContainerClassName="px-3 gap-2"
            renderItem={({ item }) => (
              <Pressable
                className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 active:opacity-70"
                onPress={() => handleSendText(item)}
              >
                <Text variant="caption" weight="medium" tone="brand">
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {/* Input Bar */}
        <View className="flex-row items-center gap-2 border-t border-line bg-surface px-3 py-2">
          <Pressable onPress={handlePickImage} className="p-1.5 active:opacity-70">
            <Ionicons name="image-outline" size={24} color="#1EB9CE" />
          </Pressable>

          <TextInput
            className="max-h-24 flex-1 rounded-full bg-canvas-subtle px-4 py-2 font-body text-body text-ink"
            placeholder="Nhắn tin cho tài xế..."
            placeholderTextColor="#9A9EA5"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendText()}
            returnKeyType="send"
          />

          <Pressable
            className={`h-10 w-10 items-center justify-center rounded-full active:opacity-70 ${
              inputText.trim() ? 'bg-brand-500' : 'bg-line'
            }`}
            onPress={() => handleSendText()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
