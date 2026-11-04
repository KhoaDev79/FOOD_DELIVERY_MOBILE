import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Icon,
  LoadingSpinner,
  Text,
  useToast,
} from '../../components/ui';
import {
  useAddTicketMessage,
  useResolveTicket,
  useSubmitCsat,
  useTicketDetail,
} from '../../services/useHelp';
import { palette } from '../../theme';
import { SupportMessage, SupportTicketStatus } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime, formatVND } from '../../utils/format';

type SupportTicketDetailRouteProp = RouteProp<RootStackParamList, 'SupportTicketDetail'>;

export const SupportTicketDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<SupportTicketDetailRouteProp>();
  const toast = useToast();

  const { ticketId } = route.params;

  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const addMessageMutation = useAddTicketMessage();
  const resolveTicketMutation = useResolveTicket();
  const submitCsatMutation = useSubmitCsat();

  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [csatModalVisible, setCsatModalVisible] = useState(false);
  const [csatScore, setCsatScore] = useState<number>(5);
  const [csatComment, setCsatComment] = useState('');

  const flatListRef = useRef<FlatList>(null);

  const isClosed = ticket?.status === 'CLOSED';
  const isResolved = ticket?.status === 'RESOLVED';

  const handlePickPhoto = async () => {
    if (attachments.length >= 3) {
      toast('Tối đa 3 hình ảnh đính kèm', 'default');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast('Vui lòng cấp quyền truy cập ảnh', 'error');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.base64) {
        const asset = res.assets[0];
        const mime = asset.mimeType || 'image/jpeg';
        setAttachments((prev) => [...prev, `data:${mime};base64,${asset.base64}`]);
      }
    } catch {
      toast('Không chọn được ảnh', 'error');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && attachments.length === 0) return;

    const content = inputText.trim() || 'Đã gửi hình ảnh đính kèm';
    setInputText('');
    const attachPayload = [...attachments];
    setAttachments([]);

    try {
      await addMessageMutation.mutateAsync({
        ticketId,
        data: {
          content,
          attachments: attachPayload,
        },
      });
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không gửi được phản hồi', 'error');
    }
  };

  const handleConfirmResolved = async () => {
    try {
      await resolveTicketMutation.mutateAsync(ticketId);
      toast('Cảm ơn bạn đã phản hồi! Xin dành ít giây đánh giá chất lượng hỗ trợ nhé.', 'success');
      setCsatModalVisible(true);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không thể cập nhật trạng thái', 'error');
    }
  };

  const handleSubmitCsat = async () => {
    try {
      await submitCsatMutation.mutateAsync({
        ticketId,
        data: {
          csatScore,
          csatComment: csatComment.trim() || undefined,
        },
      });
      setCsatModalVisible(false);
      toast('Cảm ơn bạn đã đánh giá dịch vụ!', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không gửi được đánh giá', 'error');
    }
  };

  const getStatusBadge = (status?: SupportTicketStatus) => {
    switch (status) {
      case 'NEW':
        return { label: 'Mới tiếp nhận', tone: 'brand' as const };
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', tone: 'brand' as const };
      case 'WAITING_CUSTOMER':
        return { label: 'Chờ bạn phản hồi', tone: 'warning' as const };
      case 'RESOLVED':
        return { label: 'Đã giải quyết', tone: 'success' as const };
      case 'CLOSED':
        return { label: 'Đã đóng', tone: 'neutral' as const };
      default:
        return { label: status || '', tone: 'neutral' as const };
    }
  };

  const statusConfig = getStatusBadge(ticket?.status);

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="border-b border-line bg-surface px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => navigation.goBack()}
            className="p-1 -ml-1 active:opacity-70"
          >
            <Icon name="arrow-back" size={24} tone="default" />
          </Pressable>

          <View className="items-center">
            <Text variant="headline" weight="bold">
              #{ticket?.code || 'Chi tiết phiếu'}
            </Text>
            <Badge label={statusConfig.label} tone={statusConfig.tone} size="sm" className="mt-0.5" />
          </View>

          {!isClosed && !isResolved ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleConfirmResolved}
              className="rounded-full bg-success-50 px-2.5 py-1 active:opacity-70"
            >
              <Text variant="micro" weight="bold" tone="success">
                Đã giải quyết
              </Text>
            </Pressable>
          ) : (
            <View className="w-12" />
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner message="Đang tải chi tiết phiếu..." />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <FlatList
            ref={flatListRef}
            data={ticket?.messages || []}
            keyExtractor={(item) => item.id}
            contentContainerClassName="p-4 pb-6 gap-3"
            ListHeaderComponent={
              <View className="gap-3 mb-2">
                {/* Thông tin phiếu */}
                <View className="rounded-2xl border border-line bg-surface p-4 shadow-card gap-2">
                  <Text variant="body" weight="bold" className="text-ink">
                    {ticket?.subject}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Tạo lúc: {ticket?.createdAt ? formatDateTime(ticket.createdAt) : ''}
                  </Text>

                  {/* Đơn hàng liên quan */}
                  {ticket?.order && (
                    <View className="mt-1 rounded-xl bg-canvas-subtle p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text variant="caption" weight="bold" tone="brand">
                          Đơn #{ticket.order.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <Text variant="caption" weight="bold">
                          {formatVND(ticket.order.total)}
                        </Text>
                      </View>
                      <Text variant="caption" tone="secondary">
                        Quán: {ticket.order.restaurant.name}
                      </Text>
                    </View>
                  )}

                  {/* Kết quả bồi thường tự động (nếu có) */}
                  {ticket?.resolution?.decision === 'AUTO_COMPENSATE' && (
                    <View className="mt-1 rounded-xl bg-success-50 p-3 border border-success/30">
                      <Text variant="caption" weight="bold" tone="success">
                        Hỗ trợ tự động:
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {ticket.resolution.suggestedAction}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Banner khi chờ khách phản hồi */}
                {ticket?.status === 'WAITING_CUSTOMER' && (
                  <View className="rounded-xl border border-warning/40 bg-warning-soft/40 p-3 flex-row items-center gap-2">
                    <Icon name="information-circle" size={20} tone="warning" />
                    <Text variant="caption" tone="default" className="flex-1">
                      Chuyên viên CSKH đã phản hồi. Vui lòng nhắn tin lại để chúng mình hỗ trợ tiếp nhé!
                    </Text>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }: { item: SupportMessage }) => {
              const isMe = item.senderRole === 'CUSTOMER';
              const isSystem = item.senderRole === 'SYSTEM';

              if (isSystem) {
                return (
                  <View className="my-1.5 self-center rounded-full bg-canvas-subtle px-3 py-1 border border-line-subtle">
                    <Text variant="micro" tone="muted" className="text-center">
                      {item.content}
                    </Text>
                  </View>
                );
              }

              return (
                <View className={`max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                  {/* Người gửi */}
                  <View className={`flex-row items-center gap-1 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <Text variant="micro" weight="semibold" tone={isMe ? 'brand' : 'default'}>
                      {isMe ? 'Bạn' : 'CSKH ZomZom'}
                    </Text>
                    <Text variant="micro" tone="muted">
                      · {formatDateTime(item.createdAt)}
                    </Text>
                  </View>

                  {/* Bong bóng tin nhắn */}
                  <View
                    className={`rounded-2xl p-3.5 shadow-card ${
                      isMe ? 'bg-brand-500 rounded-tr-none' : 'bg-surface rounded-tl-none border border-line'
                    }`}
                  >
                    <Text variant="body" tone={isMe ? 'inverse' : 'default'}>
                      {item.content}
                    </Text>

                    {/* Ảnh đính kèm */}
                    {item.attachments?.length > 0 && (
                      <View className="flex-row flex-wrap gap-2 mt-2">
                        {item.attachments.map((uri, idx) => (
                          <Image
                            key={idx}
                            source={{ uri }}
                            className="h-20 w-20 rounded-xl"
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {/* Khung nhập tin nhắn */}
          {!isClosed ? (
            <View
              style={{ paddingBottom: insets.bottom || 12 }}
              className="border-t border-line bg-surface p-3 gap-2 shadow-float"
            >
              {/* Preview ảnh đính kèm trước khi gửi */}
              {attachments.length > 0 && (
                <View className="flex-row gap-2">
                  {attachments.map((uri, idx) => (
                    <View key={idx} className="relative h-16 w-16 overflow-hidden rounded-xl border border-line">
                      <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setAttachments((p) => p.filter((_, i) => i !== idx))}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1"
                      >
                        <Icon name="close" size={10} tone="inverse" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ảnh"
                  onPress={handlePickPhoto}
                  className="p-2 rounded-full bg-canvas-subtle active:opacity-70"
                >
                  <Icon name="camera-outline" size={22} tone="secondary" />
                </Pressable>

                <TextInput
                  placeholder="Nhập nội dung phản hồi..."
                  placeholderTextColor={palette.ink.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  className="flex-1 min-h-10 max-h-24 rounded-2xl border border-line bg-canvas-subtle px-3.5 py-2 font-body text-body text-ink"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gửi phản hồi"
                  disabled={!inputText.trim() && attachments.length === 0}
                  onPress={handleSend}
                  className={`h-10 w-10 items-center justify-center rounded-full ${
                    inputText.trim() || attachments.length > 0 ? 'bg-brand-500' : 'bg-canvas-subtle'
                  }`}
                >
                  <Icon
                    name="send"
                    size={18}
                    tone={inputText.trim() || attachments.length > 0 ? 'inverse' : 'muted'}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              style={{ paddingBottom: insets.bottom || 16 }}
              className="border-t border-line bg-surface p-4 items-center"
            >
              <Text variant="caption" tone="muted">
                Phiếu hỗ trợ này đã được đóng. Nếu gặp vấn đề mới, bạn vui lòng tạo phiếu hỗ trợ khác nhé!
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Modal Đánh giá CSAT 1-5 sao */}
      <Modal visible={csatModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="rounded-3xl bg-surface p-6 shadow-float gap-4">
            <View className="items-center gap-1">
              <Icon name="heart-circle" size={48} tone="brand" />
              <Text variant="headline" weight="bold">
                Đánh giá chất lượng hỗ trợ
              </Text>
              <Text variant="caption" tone="secondary" className="text-center">
                Ý kiến của bạn giúp ZomZom cải thiện dịch vụ ngày một tốt hơn
              </Text>
            </View>

            {/* 5 Ngôi sao */}
            <View className="flex-row justify-center gap-2.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} sao`}
                  onPress={() => setCsatScore(star)}
                  className="p-1 active:scale-125"
                >
                  <Icon
                    name={star <= csatScore ? 'star' : 'star-outline'}
                    size={36}
                    tone={star <= csatScore ? 'warning' : 'muted'}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Góp ý thêm cho nhân viên CSKH (không bắt buộc)..."
              placeholderTextColor={palette.ink.muted}
              value={csatComment}
              onChangeText={setCsatComment}
              maxLength={300}
              multiline
              className="min-h-20 rounded-2xl border border-line bg-canvas-subtle p-3 font-body text-body text-ink"
            />

            <View className="flex-row gap-2.5">
              <Button
                label="Bỏ qua"
                variant="ghost"
                className="flex-1"
                onPress={() => setCsatModalVisible(false)}
              />
              <Button
                label="Gửi đánh giá"
                variant="primary"
                className="flex-1"
                loading={submitCsatMutation.isPending}
                onPress={handleSubmitCsat}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
