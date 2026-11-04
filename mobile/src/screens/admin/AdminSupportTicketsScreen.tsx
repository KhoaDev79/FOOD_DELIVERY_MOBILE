import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  LoadingSpinner,
  Text,
  useToast,
} from '../../components/ui';
import {
  useAdminAddTicketMessage,
  useAdminCompensateTicket,
  useAdminSupportStats,
  useAdminSupportTickets,
  useAdminUpdateTicketStatus,
  useTicketDetail,
} from '../../services/useHelp';
import { palette } from '../../theme';
import { SupportMessage, SupportTicket, SupportTicketStatus } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';

const MACRO_RESPONSES = [
  'Chào bạn, ZomZom rất tiếc về sự cố này và đang liên hệ nhà hàng để hỗ trợ bạn ngay.',
  'Chúng mình đã kiểm tra và gửi bù món cho bạn. Bạn vui lòng kiểm tra lại đơn nhé!',
  'Yêu cầu hoàn tiền qua VNPay của bạn đã được tiếp nhận và xử lý trong 1-3 ngày làm việc.',
  'Chào bạn, chúng mình đã lưu ý tài xế về thái độ phục vụ để nâng cao chất lượng dịch vụ.',
];

export const AdminSupportTicketsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Queries
  const { data: statsData } = useAdminSupportStats();
  const { data: ticketsData, isLoading, refetch, isRefetching } = useAdminSupportTickets({
    status: selectedStatus,
    q: searchQuery.trim() || undefined,
  });

  const { data: detailTicket, isLoading: loadingDetail } = useTicketDetail(selectedTicketId || '');
  const updateStatusMutation = useAdminUpdateTicketStatus();
  const addMessageMutation = useAdminAddTicketMessage();
  const compensateMutation = useAdminCompensateTicket();
  // Hộp tặng voucher bồi thường: số tiền gợi ý lấy từ đề xuất của hệ thống
  const [compAmount, setCompAmount] = useState<string | null>(null);

  const handleCompensate = async () => {
    const amount = Number((compAmount ?? '').replace(/\D/g, ''));
    if (!selectedTicketId || amount < 1000 || amount > 500_000) {
      toast('Số tiền bồi thường từ 1.000 ₫ đến 500.000 ₫', 'error');
      return;
    }
    try {
      await compensateMutation.mutateAsync({ id: selectedTicketId, amount });
      setCompAmount(null);
      toast('Đã tặng voucher bồi thường cho khách', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không tặng được voucher', 'error');
    }
  };

  const [replyText, setReplyText] = useState('');

  const tickets = ticketsData?.items || [];

  const handleUpdateStatus = async (status: SupportTicketStatus) => {
    if (!selectedTicketId) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: selectedTicketId,
        data: { status },
      });
      toast(`Đã chuyển trạng thái sang ${status}`, 'success');
    } catch {
      toast('Không thể cập nhật trạng thái', 'error');
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    const text = replyText.trim();
    setReplyText('');
    try {
      await addMessageMutation.mutateAsync({
        id: selectedTicketId,
        data: { content: text },
      });
      toast('Đã gửi phản hồi cho khách hàng', 'success');
    } catch {
      toast('Không gửi được phản hồi', 'error');
    }
  };

  const getStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'NEW':
        return { label: 'Mới tiếp nhận', tone: 'brand' as const };
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', tone: 'brand' as const };
      case 'WAITING_CUSTOMER':
        return { label: 'Chờ khách phản hồi', tone: 'warning' as const };
      case 'RESOLVED':
        return { label: 'Đã giải quyết', tone: 'success' as const };
      case 'CLOSED':
        return { label: 'Đã đóng', tone: 'neutral' as const };
      default:
        return { label: status, tone: 'neutral' as const };
    }
  };

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
            onPress={() => navigation.goBack()}
            className="p-1 -ml-1 active:opacity-70"
          >
            <Icon name="arrow-back" size={24} tone="default" />
          </Pressable>

          <Text variant="headline" weight="bold">
            Hỗ trợ khách hàng (CSKH)
          </Text>

          <View className="w-8" />
        </View>

        {/* Thanh tìm kiếm */}
        <View className="mt-3 flex-row items-center rounded-xl border border-line bg-canvas-subtle px-3 py-1.5">
          <Icon name="search-outline" size={18} tone="muted" />
          <TextInput
            placeholder="Tìm theo mã #HT, tên khách, tiêu đề..."
            placeholderTextColor={palette.ink.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 font-body text-body text-ink p-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} className="p-1">
              <Icon name="close-circle" size={16} tone="muted" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Overview Stats (ĐỢT D) */}
      <View className="flex-row gap-2.5 p-4 pb-2">
        <View className="flex-1 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <Text variant="micro" tone="muted">
            Đang mở
          </Text>
          <Text variant="title" weight="bold" tone="brand" className="mt-1">
            {statsData?.openTickets ?? 0}
          </Text>
        </View>

        <View className="flex-1 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <Text variant="micro" tone="muted">
            Đã giải quyết
          </Text>
          <Text variant="title" weight="bold" tone="success" className="mt-1">
            {statsData?.resolvedTickets ?? 0}
          </Text>
        </View>

        <View className="flex-1 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <Text variant="micro" tone="muted">
            CSAT Hài lòng
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <Icon name="star" size={16} tone="rating" />
            <Text variant="title" weight="bold">
              {statsData?.csat?.averageScore ?? 5.0}
            </Text>
          </View>
        </View>
      </View>

      {/* Bộ lọc trạng thái */}
      <View className="px-4 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {[
            { label: 'Tất cả', value: undefined },
            { label: 'Mới', value: 'NEW' },
            { label: 'Đang xử lý', value: 'IN_PROGRESS' },
            { label: 'Chờ khách', value: 'WAITING_CUSTOMER' },
            { label: 'Đã giải quyết', value: 'RESOLVED' },
            { label: 'Đã đóng', value: 'CLOSED' },
          ].map((item) => {
            const isSelected = selectedStatus === item.value;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => setSelectedStatus(item.value)}
                className={`rounded-full border px-3 py-1.5 active:opacity-75 ${
                  isSelected ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface'
                }`}
              >
                <Text
                  variant="caption"
                  weight={isSelected ? 'bold' : 'medium'}
                  tone={isSelected ? 'inverse' : 'secondary'}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Danh sách ticket */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner message="Đang tải danh sách phiếu hỗ trợ..." />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 pb-12 gap-3"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="Không có phiếu hỗ trợ nào"
              description="Hiện tại không có phiếu hỗ trợ nào khớp với bộ lọc."
            />
          }
          renderItem={({ item }: { item: SupportTicket }) => {
            const statusConfig = getStatusBadge(item.status);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedTicketId(item.id)}
                className="rounded-2xl border border-line bg-surface p-4 shadow-card active:opacity-75"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Text variant="caption" weight="bold" tone="brand">
                      #{item.code}
                    </Text>
                    {item.priority === 'URGENT' && <Badge label="Khẩn cấp" tone="danger" size="sm" />}
                    {item.priority === 'HIGH' && <Badge label="Ưu tiên cao" tone="warning" size="sm" />}
                  </View>

                  <Badge label={statusConfig.label} tone={statusConfig.tone} size="sm" />
                </View>

                <Text variant="body" weight="semibold" numberOfLines={2} className="mt-2 text-ink">
                  {item.subject}
                </Text>

                {item.order && (
                  <View className="mt-2 flex-row items-center justify-between rounded-lg bg-canvas-subtle p-2">
                    <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
                      Đơn #{item.order.id.slice(0, 8).toUpperCase()} · {item.order.restaurant.name}
                    </Text>
                    <Text variant="caption" weight="bold">
                      {formatVND(item.order.total)}
                    </Text>
                  </View>
                )}

                <View className="mt-3 flex-row items-center justify-between border-t border-line-subtle pt-2">
                  <Text variant="micro" tone="muted">
                    {formatDateTime(item.updatedAt)}
                  </Text>
                  <Text variant="caption" weight="semibold" tone="brand">
                    Xử lý phiếu →
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Modal chi tiết & phản hồi cho Admin */}
      <Modal visible={Boolean(selectedTicketId)} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-surface">
          <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
            <View>
              <Text variant="headline" weight="bold">
                Phiếu #{detailTicket?.code}
              </Text>
              <Text variant="micro" tone="muted">
                Khách: {detailTicket?.user?.fullName} ({detailTicket?.user?.phone || 'Chưa có SĐT'})
              </Text>
            </View>

            <Pressable onPress={() => setSelectedTicketId(null)} className="p-1">
              <Icon name="close" size={24} tone="default" />
            </Pressable>
          </View>

          {loadingDetail || !detailTicket ? (
            <View className="flex-1 items-center justify-center">
              <LoadingSpinner message="Đang nạp chi tiết phiếu..." />
            </View>
          ) : (
            <ScrollView contentContainerClassName="p-4 pb-24 gap-4">
              {/* Trạng thái hiện tại & Nút đổi nhanh */}
              <View className="rounded-2xl border border-line bg-canvas-subtle p-3 gap-2.5">
                <View className="flex-row items-center justify-between">
                  <Text variant="body" weight="semibold">
                    Trạng thái phiếu:
                  </Text>
                  <Badge label={detailTicket.status} tone="brand" size="md" />
                </View>

                <View className="flex-row flex-wrap gap-2">
                  <Button
                    label="Đang xử lý"
                    size="sm"
                    variant="outline"
                    onPress={() => handleUpdateStatus('IN_PROGRESS')}
                  />
                  <Button
                    label="Chờ khách"
                    size="sm"
                    variant="outline"
                    onPress={() => handleUpdateStatus('WAITING_CUSTOMER')}
                  />
                  <Button
                    label="Đã giải quyết"
                    size="sm"
                    variant="primary"
                    onPress={() => handleUpdateStatus('RESOLVED')}
                  />
                  <Button
                    label="Đóng phiếu"
                    size="sm"
                    variant="ghost"
                    onPress={() => handleUpdateStatus('CLOSED')}
                  />
                </View>
              </View>

              {/* Đề xuất của hệ thống (cây quyết định): nhân viên dựa vào đây để duyệt bồi thường */}
              {detailTicket.resolution && (
                <View className="gap-1.5 rounded-2xl border border-warning/40 bg-warning-soft p-3">
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="bulb-outline" size="sm" tone="warning" />
                    <Text variant="caption" weight="bold" tone="warning">
                      Đề xuất xử lý của hệ thống
                    </Text>
                  </View>
                  <Text variant="body" weight="semibold">
                    {detailTicket.resolution.suggestedAction}
                  </Text>
                  <Text variant="caption" weight="regular" tone="secondary">
                    Lý do: {detailTicket.resolution.reason}
                  </Text>
                  {!!detailTicket.resolution.compensationAmount && (
                    <Text variant="caption" weight="bold">
                      Giá trị đề xuất: {formatVND(detailTicket.resolution.compensationAmount)}
                    </Text>
                  )}
                  {detailTicket.resolution.voucherCode ? (
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Icon name="checkmark-circle" size="sm" tone="success" />
                      <Text variant="caption" weight="bold" tone="success">
                        Đã tặng voucher {detailTicket.resolution.voucherCode}
                      </Text>
                    </View>
                  ) : (
                    <Button
                      label="Tặng voucher bồi thường"
                      leftIcon="gift-outline"
                      size="sm"
                      variant="secondary"
                      className="mt-1 self-start"
                      onPress={() =>
                        setCompAmount(String(detailTicket.resolution?.compensationAmount || 20000))
                      }
                    />
                  )}
                </View>
              )}

              <ConfirmDialog
                visible={compAmount !== null}
                title="Tặng voucher bồi thường"
                message="Khách nhận voucher cá nhân dùng 1 lần, hạn 30 ngày, không yêu cầu đơn tối thiểu. Phiếu sẽ chuyển sang Đã giải quyết."
                confirmLabel="Tặng voucher"
                cancelLabel="Huỷ"
                loading={compensateMutation.isPending}
                onConfirm={handleCompensate}
                onCancel={() => setCompAmount(null)}
              >
                <TextInput
                  value={compAmount ? Number(compAmount.replace(/\D/g, '') || 0).toLocaleString('vi-VN') : ''}
                  onChangeText={(t) => setCompAmount(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="Số tiền (₫)"
                  accessibilityLabel="Số tiền bồi thường"
                  className="mt-2 rounded-xl border border-line bg-surface px-3 py-2.5 font-body text-body text-ink"
                />
              </ConfirmDialog>

              {/* Lịch sử tin nhắn */}
              <View className="gap-3">
                <Text variant="body" weight="bold">
                  Hội thoại trao đổi:
                </Text>

                {detailTicket.messages?.map((msg: SupportMessage) => {
                  const isAdmin = msg.senderRole === 'ADMIN';
                  const isSystem = msg.senderRole === 'SYSTEM';

                  if (isSystem) {
                    return (
                      <View key={msg.id} className="self-center rounded-full bg-canvas-subtle px-3 py-1">
                        <Text variant="micro" tone="muted">
                          {msg.content}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={msg.id}
                      className={`max-w-[85%] rounded-2xl p-3 ${
                        isAdmin
                          ? 'self-end bg-brand-500 rounded-tr-none'
                          : 'self-start bg-canvas-subtle rounded-tl-none border border-line'
                      }`}
                    >
                      <Text variant="micro" weight="bold" tone={isAdmin ? 'inverse' : 'brand'}>
                        {isAdmin ? 'Admin CSKH' : detailTicket.user?.fullName || 'Khách hàng'}
                      </Text>
                      <Text variant="body" tone={isAdmin ? 'inverse' : 'default'} className="mt-1">
                        {msg.content}
                      </Text>

                      {msg.attachments?.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {msg.attachments.map((uri: string, idx: number) => (
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
                  );
                })}
              </View>

              {/* Câu trả lời mẫu (Macros) */}
              <View className="gap-2 pt-2">
                <Text variant="caption" weight="bold" tone="secondary">
                  Câu trả lời mẫu nhanh (Macros):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  {MACRO_RESPONSES.map((macro, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => setReplyText(macro)}
                      className="max-w-xs rounded-xl border border-line bg-canvas-subtle p-2.5 active:bg-brand-50"
                    >
                      <Text variant="micro" numberOfLines={2}>
                        {macro}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Ô soạn phản hồi */}
              <View className="gap-2">
                <TextInput
                  placeholder="Nhập nội dung phản hồi cho khách..."
                  placeholderTextColor={palette.ink.muted}
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  className="min-h-24 rounded-2xl border border-line bg-canvas-subtle p-3 font-body text-body text-ink"
                />
                <Button
                  label="Gửi phản hồi cho khách"
                  variant="primary"
                  loading={addMessageMutation.isPending}
                  disabled={!replyText.trim()}
                  onPress={handleSendReply}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};
