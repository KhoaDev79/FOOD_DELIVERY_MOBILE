import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from '../../components/common/Card';
import { colors } from '../../constants/colors';
import { RootStackParamList } from '../../types/navigation';

interface ChatConversation {
  id: string;
  orderId: string;
  name: string;
  role: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
}

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  isRead: boolean;
}

const CHAT_LIST: ChatConversation[] = [
  {
    id: 'conv-1',
    orderId: 'ord-101',
    name: 'Tài xế Nguyễn Văn Tài',
    role: 'Tài xế giao hàng',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
    lastMessage: 'Dạ quán đang làm món, em đợi lấy rồi giao ngay cho mình nhé ạ!',
    time: 'Vừa xong',
    unreadCount: 1,
  },
  {
    id: 'conv-2',
    orderId: 'ord-102',
    name: 'Hana Chicken Support',
    role: 'Chủ nhà hàng',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=200',
    lastMessage: 'Quán đã thêm sốt tương tỏi và đũa muỗng theo yêu cầu của bạn rồi nhé.',
    time: '14:20',
    unreadCount: 0,
  },
];

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Đơn hàng đang được giao 🛵',
    content: 'Tài xế Nguyễn Văn Tài đang trên đường giao đơn cơm tấm đến cho bạn.',
    time: '5 phút trước',
    icon: 'bicycle-outline',
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'Khuyến mãi giờ vàng giảm 50k 🎁',
    content: 'Nhập mã GIOGV50 để được giảm ngay 50.000đ cho đơn từ 150k hôm nay!',
    time: '2 giờ trước',
    icon: 'gift-outline',
    isRead: true,
  },
  {
    id: 'notif-3',
    title: 'Đơn hàng giao thành công 🎉',
    content: 'Đơn hàng #FD-8924 đã được giao thành công. Hãy đánh giá dịch vụ nhé!',
    time: 'Hôm qua',
    icon: 'checkmark-circle-outline',
    isRead: true,
  },
];

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<'chats' | 'notifications'>('chats');

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hộp thư & Tin nhắn</Text>
      </View>

      {/* Switcher Tab */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chats')}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={16}
            color={activeTab === 'chats' ? '#EE4D2D' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
            Trò chuyện (2)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'notifications' && styles.tabButtonActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <Ionicons
            name="notifications"
            size={16}
            color={activeTab === 'notifications' ? '#EE4D2D' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Thông báo (3)
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'chats' ? (
        <FlatList
          data={CHAT_LIST}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.chatCard}>
              <TouchableOpacity
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('Chat', {
                    orderId: item.orderId,
                    recipientName: item.name,
                    recipientRole: item.role,
                  })
                }
              >
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>{item.name}</Text>
                    <Text style={styles.chatTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.chatRole}>{item.role}</Text>
                  <Text style={styles.lastMsg} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={NOTIFICATIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={[styles.notifCard, !item.isRead && styles.notifUnread]}>
              <View style={styles.notifRow}>
                <View style={styles.notifIconCircle}>
                  <Ionicons name={item.icon} size={22} color="#EE4D2D" />
                </View>
                <View style={styles.notifInfo}>
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.notifContent}>{item.content}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#FFF0ED',
    borderWidth: 1,
    borderColor: '#EE4D2D',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#EE4D2D', fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 30 },
  chatCard: { padding: 12, marginBottom: 10, borderRadius: 12 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5E7EB' },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '700', color: colors.text },
  chatTime: { fontSize: 11, color: colors.textMuted },
  chatRole: { fontSize: 11, color: '#EE4D2D', fontWeight: '600', marginBottom: 2 },
  lastMsg: { fontSize: 13, color: colors.textSecondary },
  unreadBadge: {
    backgroundColor: '#EE4D2D',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  notifCard: { padding: 14, marginBottom: 10, borderRadius: 12 },
  notifUnread: { backgroundColor: '#FFFBF9', borderColor: '#FFD9D0', borderWidth: 1 },
  notifRow: { flexDirection: 'row', gap: 12 },
  notifIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifInfo: { flex: 1 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: 6 },
  notifTime: { fontSize: 11, color: colors.textMuted },
  notifContent: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});

