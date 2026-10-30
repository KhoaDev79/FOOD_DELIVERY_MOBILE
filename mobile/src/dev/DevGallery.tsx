import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppImage,
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  CountBadge,
  Divider,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterChip,
  Gradient,
  IconButton,
  InfoChip,
  Input,
  ListRow,
  OrderStatusBadge,
  QuantityStepper,
  RestaurantRowSkeleton,
  SearchBar,
  SectionHeader,
  Skeleton,
  StatCard,
  Text,
  TileSkeleton,
  TopBar,
  useToast,
} from '../components/ui';
import { palette } from '../theme';
import { OrderStatus } from '../types/api';

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-3 border-b border-line-subtle px-4 py-5">
    <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
      {title}
    </Text>
    {children}
  </View>
);

const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
];

/**
 * Thư viện thành phần – CHỈ dùng khi phát triển.
 * Web: mở http://localhost:8081/?gallery ; điện thoại: Tài khoản → "Thư viện thành phần" (chỉ hiện khi __DEV__).
 * Mọi dữ liệu ở đây là ví dụ minh hoạ thành phần, không hiển thị trong app thật.
 */
export const DevGallery: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'near'>('all');
  const [search, setSearch] = useState('');
  const [toggle, setToggle] = useState(true);
  const [chip, setChip] = useState(false);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <TopBar title="Thư viện thành phần" leading={onClose ? 'close' : 'none'} onLeadingPress={onClose} />
      <ScrollView contentContainerClassName="pb-24">
        <Block title="Chữ">
          <Text variant="display">Góc khoái khẩu</Text>
          <Text variant="title">Quán gần tôi</Text>
          <Text variant="headline">Đường Dương Quảng Hàm</Text>
          <Text variant="body-lg">Phở bò tái nạm, cà phê muối, bánh xèo giòn rụm</Text>
          <Text variant="body" tone="secondary">
            Chữ phụ: ỷ ỵ ữ ự ẫ ẩ ẽ ặ ổ ờ ợ ứ ừ ử ỡ
          </Text>
          <Text variant="caption" tone="muted">
            Chú thích nhỏ
          </Text>
          <Text variant="price">45.000 ₫</Text>
        </Block>

        <Block title="Nút">
          <Button label="Đặt món" onPress={() => toast('Đã bấm nút chính', 'success')} />
          <Button label="Thêm bộ sưu tập mới" variant="secondary" leftIcon="add" onPress={() => {}} />
          <View className="flex-row flex-wrap gap-2">
            <Button label="Viền" variant="outline" size="md" onPress={() => {}} />
            <Button label="Chữ" variant="ghost" size="md" onPress={() => {}} />
            <Button label="Xoá" variant="danger" size="md" leftIcon="trash-outline" onPress={() => {}} />
            <Button label="Nhỏ" size="sm" onPress={() => {}} />
          </View>
          <View className="flex-row gap-2">
            <Button label="Đang gửi" loading size="md" className="flex-1" onPress={() => {}} />
            <Button label="Vô hiệu" disabled size="md" className="flex-1" onPress={() => {}} />
          </View>
          <View className="flex-row items-center gap-3">
            <IconButton icon="arrow-back" accessibilityLabel="Quay lại" />
            <IconButton icon="arrow-forward" accessibilityLabel="Xem tất cả" />
            <IconButton icon="add" accessibilityLabel="Thêm" variant="brand" />
            <IconButton icon="heart-outline" accessibilityLabel="Yêu thích" variant="scrim" size="sm" />
            <IconButton icon="close" accessibilityLabel="Đóng" variant="subtle" />
            <IconButton icon="locate-outline" accessibilityLabel="Định vị" disabled />
          </View>
        </Block>

        <Block title="Ô nhập & tìm kiếm">
          <SearchBar size="lg" onPressAsButton={() => {}} />
          <SearchBar value={search} onChangeText={setSearch} onClear={() => setSearch('')} />
          <Input label="Email" placeholder="ban@vidu.com" leftIcon="mail-outline" />
          <Input label="Mật khẩu" placeholder="Nhập mật khẩu" leftIcon="lock-closed-outline" password />
          <Input label="Số điện thoại" value="0901" error="Số điện thoại không hợp lệ" leftIcon="call-outline" />
          <Input label="Không sửa được" value="Đã khoá" editable={false} />
        </Block>

        <Block title="Huy hiệu & chip">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label="Giảm 30%" tone="discount" />
            <Badge label="4.7" tone="scrim" icon="star" />
            <Badge label="Mở cửa" tone="success" />
            <Badge label="Đã đóng" tone="danger" />
            <Badge label="Mới" tone="brand" />
            <View className="h-8 w-8 rounded-full bg-canvas-subtle">
              <CountBadge count={3} className="absolute -right-1 -top-1" />
            </View>
            <View className="h-8 w-8 rounded-full bg-canvas-subtle">
              <CountBadge count={120} className="absolute -right-2 -top-1" />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <InfoChip label="Giảm 15.000 ₫" tone="voucher" icon="ticket-outline" />
            <InfoChip label="Freeship" tone="freeship" icon="cube-outline" />
            <InfoChip label="2,1 km" icon="navigate-outline" />
            <FilterChip label="Đang mở cửa" selected={chip} icon="time-outline" onPress={() => setChip((v) => !v)} />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {STATUSES.map((s) => (
              <OrderStatusBadge key={s} status={s} />
            ))}
          </View>
        </Block>

        <Block title="Thẻ, ảnh, avatar">
          <Card>
            <Text variant="body-lg" weight="semibold">
              Thẻ nổi
            </Text>
            <Text variant="body" tone="secondary">
              Thẻ có bóng nhẹ, bo 16.
            </Text>
          </Card>
          <Card variant="flat" onPress={() => toast('Đã chạm thẻ')}>
            <Text variant="body-lg">Thẻ phẳng, chạm được</Text>
          </Card>
          <View className="flex-row gap-3">
            <AppImage uri="/public/images/food/pho.jpg" className="h-28 w-28 rounded-lg" accessibilityLabel="Phở" />
            <AppImage uri={null} className="h-28 w-28 rounded-lg" />
            <AppImage
              uri="https://invalid.invalid/x.jpg"
              className="h-28 w-28 rounded-lg"
              fallbackIcon="fast-food-outline"
            />
          </View>
          <View className="flex-row items-center gap-3">
            <Avatar name="Trần Minh Khoa" size="sm" />
            <Avatar name="Trần Minh Khoa" size="md" />
            <Avatar name="Lan" size="lg" />
            <Avatar name="Nguyễn Văn An" size="xl" />
          </View>
        </Block>

        <Block title="Số lượng, công tắc">
          <QuantityStepper value={qty} onChange={setQty} />
          <QuantityStepper value={0} onChange={() => {}} size="sm" disabled />
          <View className="flex-row items-center justify-between">
            <Text variant="body-lg">Công tắc</Text>
            <Switch
              value={toggle}
              onValueChange={setToggle}
              trackColor={{ true: palette.brand['500'], false: palette.line.DEFAULT }}
              thumbColor={palette.surface}
            />
          </View>
        </Block>

        <Block title="Dòng danh sách">
          <View>
            <ListRow
              icon="heart"
              iconTone="danger"
              title="Địa chỉ đã lưu"
              subtitle="Lưu địa chỉ để đặt món nhanh hơn."
              onPress={() => {}}
            />
            <ListRow icon="map-outline" title="Tìm trên bản đồ" onPress={() => {}} />
            <Divider />
            <ListRow icon="log-out-outline" title="Đăng xuất" destructive onPress={() => setDialog(true)} />
          </View>
        </Block>

        <Block title="Tiêu đề phần">
          <View className="-mx-4 gap-4">
            <SectionHeader
              title="Quán gần tôi"
              subtitle="Sắp xếp theo khoảng cách"
              icon="location"
              iconTone="danger"
              onSeeAll={() => {}}
            />
            <SectionHeader title="Tiêu đề rất dài để kiểm tra dấu ba chấm khi tràn dòng" onSeeAll={() => {}} />
          </View>
        </Block>

        <Block title="Gradient">
          <Gradient preset="header" className="h-24 rounded-lg" />
          <Gradient preset="brandPill" className="h-12 rounded-full" />
        </Block>

        <Block title="Skeleton">
          <RestaurantRowSkeleton />
          <View className="flex-row gap-3">
            <TileSkeleton />
            <TileSkeleton />
          </View>
          <Skeleton className="h-4 w-1/2" />
        </Block>

        <Block title="Trạng thái">
          <EmptyState
            variant="card"
            icon="heart-outline"
            title="Chưa có quán yêu thích"
            description="Bạn chưa có quán nào trong bộ sưu tập. Hãy thêm vài quán ruột vào nhé!"
          />
          <EmptyState
            icon="basket-outline"
            title="Giỏ hàng đang trống!"
            description="Thêm món vào giỏ để bắt đầu đặt hàng."
            actionLabel="Khám phá món ngon"
            onAction={() => {}}
          />
          <ErrorState onRetry={() => toast('Đang thử lại…')} />
        </Block>

        <Block title="Quản lý">
          <View className="flex-row gap-3">
            <StatCard label="Đơn hôm nay" value="—" icon="receipt-outline" caption="Lấy từ API" />
            <StatCard label="Doanh thu" value="—" icon="cash-outline" iconTone="success" />
          </View>
          <View className="-mx-4">
            <FilterBar
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'open', label: 'Đang mở' },
                { value: 'near', label: 'Gần nhất' },
              ]}
            />
          </View>
        </Block>

        <Block title="Lớp phủ">
          <View className="flex-row flex-wrap gap-2">
            <Button label="Mở bảng trượt" variant="outline" size="md" onPress={() => setSheet(true)} />
            <Button label="Mở hộp xác nhận" variant="outline" size="md" onPress={() => setDialog(true)} />
            <Button
              label="Hiện toast lỗi"
              variant="outline"
              size="md"
              onPress={() => toast('Không thể kết nối máy chủ', 'error')}
            />
          </View>
        </Block>
      </ScrollView>

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Tuỳ chọn món"
        footer={<Button label="Thêm vào giỏ" onPress={() => setSheet(false)} className="mb-2" />}
      >
        <ListRow title="Size lớn" subtitle="+10.000 ₫" />
        <ListRow title="Thêm trân châu" subtitle="+5.000 ₫" />
      </BottomSheet>
      <ConfirmDialog
        visible={dialog}
        title="Đăng xuất?"
        message="Bạn sẽ cần đăng nhập lại để đặt món."
        confirmLabel="Đăng xuất"
        destructive
        onCancel={() => setDialog(false)}
        onConfirm={() => setDialog(false)}
      />
    </SafeAreaView>
  );
};
