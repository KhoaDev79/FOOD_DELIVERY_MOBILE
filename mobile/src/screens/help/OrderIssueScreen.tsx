import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  ConfirmDialog,
  Divider,
  Icon,
  LoadingSpinner,
  Text,
  useToast,
} from '../../components/ui';
import { useCreateTicket } from '../../services/useHelp';
import { CancelOrderSheet } from '../../components/modules/order/CancelOrderSheet';
import { useMyOrders, useOrderDetail } from '../../services/useOrders';
import { palette } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime, formatVND } from '../../utils/format';

type OrderIssueRouteProp = RouteProp<RootStackParamList, 'OrderIssue'>;

interface IssueCategoryOption {
  type: string;
  label: string;
  icon: string;
  description: string;
  requiresPhoto?: boolean;
}

export const OrderIssueScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<OrderIssueRouteProp>();
  const toast = useToast();

  const initialOrderId = route.params?.orderId;
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(initialOrderId);

  // Queries
  const { data: myOrdersData, isLoading: loadingMyOrders } = useMyOrders();
  const { data: orderDetail } = useOrderDetail(selectedOrderId || "");

  const createTicketMutation = useCreateTicket();
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Form states
  const [selectedIssueType, setSelectedIssueType] = useState<string>(route.params?.preselectedIssue || '');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({}); // itemId -> quantity
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [resultDialog, setResultDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    ticketId: string;
  } | null>(null);

  // Danh sách các vấn đề theo trạng thái đơn hàng (Cây quyết định ĐỢT B)
  const availableIssues = useMemo<IssueCategoryOption[]>(() => {
    if (!orderDetail) return [];

    const isPending = orderDetail.status === 'PENDING';
    const isInProgress = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'].includes(orderDetail.status);
    const isDelivered = orderDetail.status === 'DELIVERED';
    const isCancelled = ['CANCELLED', 'FAILED'].includes(orderDetail.status);

    if (isPending || isInProgress) {
      return [
        {
          type: 'DELAYED_ORDER',
          label: 'Đơn đến trễ / Chưa nhận được',
          icon: 'time-outline',
          description: 'Thời gian giao hàng lâu hơn dự kiến',
        },
        {
          type: 'CANCEL_REQUEST',
          label: isPending ? 'Muốn huỷ đơn (Miễn phí)' : 'Yêu cầu huỷ đơn hàng',
          icon: 'close-circle-outline',
          description: isPending ? 'Quán chưa tiếp nhận, huỷ ngay không mất phí' : 'Quán đã chuẩn bị, cần hỗ trợ riêng',
        },
        {
          type: 'CONTACT_PARTY',
          label: 'Cần liên hệ Quán hoặc Tài xế',
          icon: 'chatbubbles-outline',
          description: 'Hỏi về món ăn, ghi chú hoặc vị trí giao hàng',
        },
      ];
    }

    if (isDelivered) {
      return [
        {
          type: 'MISSING_ITEMS',
          label: 'Thiếu món trong đơn',
          icon: 'remove-circle-outline',
          description: 'Đơn hàng giao thiếu một hoặc nhiều món',
        },
        {
          type: 'WRONG_ITEMS',
          label: 'Giao sai món',
          icon: 'alert-circle-outline',
          description: 'Món nhận được không đúng với món đã đặt',
          requiresPhoto: true,
        },
        {
          type: 'DAMAGED_ITEMS',
          label: 'Món bị đổ vỡ / hư hỏng',
          icon: 'trash-outline',
          description: 'Bao bì rách, đổ nước, hộp bị móp méo khi nhận',
          requiresPhoto: true,
        },
        {
          type: 'FOOD_QUALITY',
          label: 'Chất lượng món ăn không tốt',
          icon: 'restaurant-outline',
          description: 'Đồ ăn nguội, có mùi lạ hoặc không hợp vệ sinh',
        },
        {
          type: 'DRIVER_ATTITUDE',
          label: 'Tài xế có thái độ chưa tốt',
          icon: 'person-outline',
          description: 'Giao tiếp thô lỗ, vòi thêm tiền ngoài ứng dụng',
        },
        {
          type: 'WRONG_PRICE',
          label: 'Bị tính sai số tiền',
          icon: 'card-outline',
          description: 'Số tiền thu khác với giá trị trên đơn hàng',
        },
      ];
    }

    if (isCancelled) {
      return [
        {
          type: 'NOT_MY_CANCELLATION',
          label: 'Tôi không yêu cầu huỷ đơn này',
          icon: 'help-circle-outline',
          description: 'Đơn bị huỷ đột ngột mà không rõ lý do',
        },
        {
          type: 'QUESTION_ABOUT_CANCELLATION',
          label: 'Thắc mắc về hoàn tiền / huỷ đơn',
          icon: 'cash-outline',
          description: 'Tiền trừ qua thẻ/ví chưa thấy hoàn lại',
        },
      ];
    }

    return [];
  }, [orderDetail]);

  const currentIssueConfig = availableIssues.find((i) => i.type === selectedIssueType);
  // Đơn chưa được quán nhận: khách tự huỷ ngay, không cần tạo phiếu chờ nhân viên
  const isInstantCancel = selectedIssueType === 'CANCEL_REQUEST' && orderDetail?.status === 'PENDING';


  // Xử lý chọn/bỏ chọn món bị thiếu hoặc sai
  const toggleItemSelection = (itemId: string, _maxQty: number) => {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[itemId]) {
        delete copy[itemId];
      } else {
        copy[itemId] = 1;
      }
      return copy;
    });
  };

  const updateItemQty = (itemId: string, delta: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 1;
      const next = Math.max(1, Math.min(maxQty, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  // Chọn ảnh minh chứng (tối đa 3 ảnh)
  const handlePickPhoto = async () => {
    if (attachments.length >= 3) {
      toast('Tối đa 3 hình ảnh đính kèm', 'default');
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast('Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
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
        const dataUri = `data:${mime};base64,${asset.base64}`;
        setAttachments((prev) => [...prev, dataUri]);
      }
    } catch {
      toast('Không chọn được ảnh, vui lòng thử lại', 'error');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Gửi báo cáo sự cố
  const handleSubmit = async () => {
    if (!orderDetail) {
      toast('Vui lòng chọn đơn hàng cần báo sự cố', 'default');
      return;
    }

    if (!selectedIssueType) {
      toast('Vui lòng chọn loại vấn đề gặp phải', 'default');
      return;
    }

    if (isInstantCancel) {
      setConfirmCancel(true);
      return;
    }

    if (currentIssueConfig?.requiresPhoto && attachments.length === 0) {
      toast('Vấn đề này bắt buộc phải có ít nhất 1 ảnh chụp minh chứng', 'error');
      return;
    }

    const needsItems = ['MISSING_ITEMS', 'WRONG_ITEMS'].includes(selectedIssueType);
    if (needsItems && Object.keys(selectedItems).length === 0) {
      toast('Vui lòng tích chọn món bị ảnh hưởng bên dưới', 'default');
      return;
    }

    const affectedItemsPayload = needsItems
      ? Object.entries(selectedItems).map(([id, qty]) => {
          const item = orderDetail.items?.find((i) => i.id === id);
          return {
            name: item?.name || 'Món ăn',
            quantity: qty,
            price: item?.unitPrice || 0,
          };
        })
      : undefined;

    try {
      const res = await createTicketMutation.mutateAsync({
        orderId: orderDetail.id,
        category: 'ORDER_ISSUE',
        subject: `[Đơn #${orderDetail.id.slice(0, 8).toUpperCase()}] ${currentIssueConfig?.label || 'Báo sự cố'}`,
        description: description.trim() || currentIssueConfig?.label || 'Báo sự cố đơn hàng',
        issueType: selectedIssueType,
        affectedItems: affectedItemsPayload,
        attachments,
      });

      if (res.resolution?.decision === 'AUTO_COMPENSATE') {
        setResultDialog({
          visible: true,
          title: 'Hỗ trợ tự động thành công',
          message: `${res.resolution.suggestedAction}\n\nLý do: ${res.resolution.reason}\nMã phiếu hỗ trợ: ${res.code}`,
          ticketId: res.id,
        });
      } else {
        setResultDialog({
          visible: true,
          title: 'Đã gửi yêu cầu hỗ trợ',
          message: `Phiếu hỗ trợ #${res.code} đã được tạo. Nhân viên CSKH ZomZom sẽ kiểm tra và phản hồi bạn sớm nhất; bạn sẽ nhận thông báo khi có kết quả.`,
          ticketId: res.id,
        });
      }
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không thể tạo yêu cầu hỗ trợ, vui lòng thử lại', 'error');
    }
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="flex-row items-center justify-between border-b border-line bg-surface px-4 py-3"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          className="p-1 -ml-1 active:opacity-70"
        >
          <Icon name="arrow-back" size={24} tone="default" />
        </Pressable>

        <Text variant="headline" weight="bold">
          Báo vấn đề đơn hàng
        </Text>

        <View className="w-8" />
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24 gap-5" showsVerticalScrollIndicator={false}>
        {/* Mục 1: Chọn đơn hàng (nếu chưa chọn sẵn) */}
        {!initialOrderId && (
          <View className="gap-2">
            <Text variant="body" weight="semibold">
              Chọn đơn hàng cần hỗ trợ
            </Text>

            {loadingMyOrders ? (
              <LoadingSpinner message="Đang tải danh sách đơn..." />
            ) : !myOrdersData?.items?.length ? (
              <View className="rounded-xl border border-line bg-surface p-4">
                <Text variant="body" tone="secondary">
                  Bạn chưa có đơn hàng nào để khiếu nại.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
                {myOrdersData.items.slice(0, 5).map((ord) => {
                  const isSelected = ord.id === selectedOrderId;
                  return (
                    <Pressable
                      key={ord.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedOrderId(ord.id);
                        setSelectedIssueType('');
                        setSelectedItems({});
                      }}
                      className={`w-64 rounded-2xl border p-3 ${
                        isSelected ? 'border-brand-500 bg-brand-50/50 shadow-card' : 'border-line bg-surface shadow-none'
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text variant="caption" weight="bold" tone="brand">
                          #{ord.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <Badge label={ord.status} tone="neutral" size="sm" />
                      </View>
                      <Text variant="body" weight="semibold" numberOfLines={1} className="mt-1">
                        {ord.restaurant.name}
                      </Text>
                      <Text variant="micro" tone="muted">
                        {formatDateTime(ord.createdAt)} · {formatVND(ord.total)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Thông tin đơn hàng đã chọn */}
        {orderDetail && (
          <View className="gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Icon name="receipt-outline" size={18} tone="brand" />
                <Text variant="body" weight="bold">
                  Đơn #{orderDetail.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
              <Badge label={orderDetail.status} tone="brand" size="sm" />
            </View>

            <Divider />

            <View className="gap-1">
              <Text variant="body" weight="semibold">
                {orderDetail.restaurant.name}
              </Text>
              <Text variant="caption" tone="secondary">
                Đặt lúc: {formatDateTime(orderDetail.createdAt)} · Tổng thanh toán: {formatVND(orderDetail.total)}
              </Text>
            </View>
          </View>
        )}

        {/* Mục 2: Chọn loại vấn đề */}
        {orderDetail && (
          <View className="gap-2.5">
            <Text variant="body" weight="semibold">
              Vấn đề bạn gặp phải là gì?
            </Text>

            <View className="gap-2">
              {availableIssues.map((issue) => {
                const isSelected = selectedIssueType === issue.type;
                return (
                  <Pressable
                    key={issue.type}
                    accessibilityRole="button"
                    onPress={() => setSelectedIssueType(issue.type)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3.5 active:opacity-70 ${
                      isSelected ? 'border-brand-500 bg-brand-50/60 shadow-card' : 'border-line bg-surface shadow-none'
                    }`}
                  >
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-xl ${
                        isSelected ? 'bg-brand-500' : 'bg-canvas-subtle'
                      }`}
                    >
                      <Icon name={issue.icon as any} size={20} tone={isSelected ? 'inverse' : 'default'} />
                    </View>

                    <View className="flex-1">
                      <Text variant="body" weight={isSelected ? 'bold' : 'medium'}>
                        {issue.label}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {issue.description}
                      </Text>
                    </View>

                    {isSelected && <Icon name="checkmark-circle" size={20} tone="brand" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Mục 3: Chọn món bị thiếu/sai (nếu chọn MISSING_ITEMS hoặc WRONG_ITEMS) */}
        {['MISSING_ITEMS', 'WRONG_ITEMS'].includes(selectedIssueType) && orderDetail?.items && (
          <View className="gap-2.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Text variant="body" weight="semibold">
              Tích chọn món bị ảnh hưởng:
            </Text>

            <View className="gap-2">
              {orderDetail.items.map((item) => {
                const isChecked = Boolean(selectedItems[item.id]);
                const qty = selectedItems[item.id] || 1;

                return (
                  <View
                    key={item.id}
                    className={`flex-row items-center justify-between rounded-xl border p-3 ${
                      isChecked ? 'border-brand-500 bg-brand-50/30' : 'border-line bg-canvas-subtle'
                    }`}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      onPress={() => toggleItemSelection(item.id, item.quantity)}
                      className="flex-1 flex-row items-center gap-2.5"
                    >
                      <Icon
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        tone={isChecked ? 'brand' : 'muted'}
                      />
                      <View className="flex-1">
                        <Text variant="body" weight="medium">
                          {item.name}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {formatVND(item.unitPrice)} (Đã đặt: x{item.quantity})
                        </Text>
                      </View>
                    </Pressable>

                    {isChecked && (
                      <View className="flex-row items-center gap-2 rounded-full border border-line bg-surface px-2 py-1">
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => updateItemQty(item.id, -1, item.quantity)}
                          className="p-1 active:opacity-60"
                        >
                          <Icon name="remove" size={14} tone="default" />
                        </Pressable>
                        <Text variant="body" weight="bold">
                          {qty}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => updateItemQty(item.id, 1, item.quantity)}
                          className="p-1 active:opacity-60"
                        >
                          <Icon name="add" size={14} tone="default" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Mục 4: Mô tả chi tiết */}
        {selectedIssueType && (
          <View className="gap-2">
            <Text variant="body" weight="semibold">
              Mô tả chi tiết (không bắt buộc)
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              placeholder="Vui lòng cung cấp thêm thông tin để CSKH hỗ trợ bạn nhanh hơn..."
              placeholderTextColor={palette.ink.muted}
              value={description}
              onChangeText={setDescription}
              className="min-h-24 rounded-2xl border border-line bg-surface p-3 font-body text-body text-ink"
            />
            <Text variant="micro" tone="muted" className="text-right">
              {description.length}/500 ký tự
            </Text>
          </View>
        )}

        {/* Mục 5: Đính kèm hình ảnh minh chứng */}
        {selectedIssueType && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="body" weight="semibold">
                Hình ảnh minh chứng {currentIssueConfig?.requiresPhoto && <Text tone="danger">*</Text>}
              </Text>
              <Text variant="caption" tone="secondary">
                {attachments.length}/3 ảnh
              </Text>
            </View>

            {currentIssueConfig?.requiresPhoto && (
              <Text variant="micro" tone="danger">
                * Vui lòng chụp rõ món ăn nhận được hoặc tình trạng hư hỏng để được giải quyết nhanh nhất.
              </Text>
            )}

            <View className="flex-row flex-wrap gap-2.5">
              {attachments.map((uri, idx) => (
                <View key={idx} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
                  <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa ảnh"
                    onPress={() => handleRemovePhoto(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 active:opacity-70"
                  >
                    <Icon name="close" size={12} tone="inverse" />
                  </Pressable>
                </View>
              ))}

              {attachments.length < 3 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thêm ảnh"
                  onPress={handlePickPhoto}
                  className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line bg-surface active:bg-canvas-subtle"
                >
                  <Icon name="camera-outline" size={24} tone="brand" />
                  <Text variant="micro" tone="brand" className="mt-1">
                    Thêm ảnh
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Submit Button */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-4 pt-3 shadow-float"
      >
        <Button
          label={isInstantCancel ? 'Huỷ đơn miễn phí' : 'Gửi yêu cầu hỗ trợ'}
          variant={isInstantCancel ? 'danger' : 'primary'}
          size="lg"
          loading={createTicketMutation.isPending}
          disabled={!orderDetail || !selectedIssueType}
          onPress={handleSubmit}
        />
      </View>

      {/* Xác nhận huỷ đơn (đơn chưa được quán nhận) */}
      {orderDetail && (
        <CancelOrderSheet
          visible={confirmCancel}
          orderId={orderDetail.id}
          onClose={() => setConfirmCancel(false)}
          onCancelled={() => navigation.replace('OrderTracking', { orderId: orderDetail.id })}
        />
      )}

      {/* Dialog kết quả */}
      <ConfirmDialog
        visible={Boolean(resultDialog?.visible)}
        title={resultDialog?.title || ''}
        message={resultDialog?.message || ''}
        confirmLabel="Xem phiếu hỗ trợ"
        cancelLabel="Đóng"
        onConfirm={() => {
          const id = resultDialog?.ticketId;
          setResultDialog(null);
          if (id) {
            navigation.replace('SupportTicketDetail', { ticketId: id });
          } else {
            navigation.goBack();
          }
        }}
        onCancel={() => {
          setResultDialog(null);
          navigation.goBack();
        }}
      />
    </View>
  );
};
