import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
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
    text: 'Dạ vâng, em vừa dặn chủ quán bỏ thêm đầy đủ tương ớt và muỗng đũa rồi ạ.',
    time: '12:06',
  },
];

const QUICK_REPLIES = [
  'Đã tới chưa bạn ơi?',
  'Cho mình xin thêm đũa muỗng nhé',
  'Cứ để trước cửa phòng giúp mình',
  'Gọi điện khi tới nơi nhé',
];

export const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const recipientName = route.params?.recipientName || 'Tài xế giao hàng';
  const recipientRole = route.params?.recipientRole || 'Đang giao đơn hàng';
  const orderId = route.params?.orderId;

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSendText = (textToSend?: string) => {
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
  };

  const handlePickImage = async () => {
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
  };

  const handleOpenCall = () => {
    navigation.navigate('DriverCall', {
      orderId: orderId || 'ord-call',
      driverName: recipientName,
      driverPhone: '0908 123 456',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{recipientName.charAt(0).toUpperCase()}</Text>
          <View style={styles.activeDot} />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {recipientName}
          </Text>
          <Text style={styles.headerRole}>{recipientRole}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenCall} style={styles.headerActionBtn}>
            <Ionicons name="call" size={20} color="#EE4D2D" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Messages Stream */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isUser = item.sender === 'user';
            return (
              <View style={[styles.messageRow, isUser ? styles.userRow : styles.otherRow]}>
                {!isUser && (
                  <View style={styles.otherAvatarCircle}>
                    <Text style={styles.otherAvatarChar}>{recipientName.charAt(0)}</Text>
                  </View>
                )}

                <View style={[styles.bubble, isUser ? styles.userBubble : styles.otherBubble]}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
                  ) : null}
                  {item.text ? (
                    <Text style={[styles.bubbleText, isUser ? styles.userText : styles.otherText]}>
                      {item.text}
                    </Text>
                  ) : null}
                  <Text style={[styles.timeText, isUser ? styles.userTime : styles.otherTime]}>
                    {item.time}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Quick Replies Carousel */}
        <View style={styles.quickRepliesWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={QUICK_REPLIES}
            keyExtractor={(_, idx) => String(idx)}
            contentContainerStyle={styles.quickRepliesContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => handleSendText(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={handlePickImage} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={24} color="#EE4D2D" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Nhắn tin cho tài xế..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendText()}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSendText()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 6, marginRight: 4 },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 10,
  },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerRole: { fontSize: 12, color: colors.textMuted },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: { padding: 16, paddingBottom: 10 },
  messageRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  otherRow: { justifyContent: 'flex-start' },
  otherAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  otherAvatarChar: { color: colors.white, fontSize: 13, fontWeight: '700' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  userBubble: {
    backgroundColor: '#EE4D2D',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: colors.white },
  otherText: { color: colors.text },
  messageImage: { width: 180, height: 140, borderRadius: 10, marginBottom: 6 },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  userTime: { color: 'rgba(255,255,255,0.7)' },
  otherTime: { color: colors.textMuted },
  quickRepliesWrap: { backgroundColor: colors.white, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  quickRepliesContent: { paddingHorizontal: 12, gap: 8 },
  quickChip: {
    backgroundColor: '#FFF0ED',
    borderWidth: 1,
    borderColor: '#FFD5CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickChipText: { fontSize: 12, color: '#EE4D2D', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    gap: 8,
  },
  iconBtn: { padding: 6 },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EE4D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#E5E7EB' },
});

