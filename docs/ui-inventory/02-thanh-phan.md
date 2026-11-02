# Phụ lục 02 — Kiểm kê thành phần dùng chung (mục 4)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md)

Bộ thành phần chính ("kit") nằm ở `mobile/src/components/ui/` (25 file, xuất qua `index.ts`). Thư mục `mobile/src/components/common/` là bộ cũ viết bằng StyleSheet, gần như không còn dùng. `mobile/src/components/modules/` chứa thành phần nghiệp vụ (thẻ quán, sheet admin, chat…).

"Số nơi dùng" = số thẻ JSX tìm thấy trong `mobile/src` (không tính file định nghĩa) / số file. Số liệu tự động; đủ ở [07 §13.7](07-phu-luc-tho.md#137-số-lần-dùng-từng-thành-phần-dùng-chung).

## Mục lục

- [4.1 Bảng tổng hợp](#41-bảng-tổng-hợp)
- [4.2 Chi tiết từng thành phần kit](#42-chi-tiết-từng-thành-phần-kit)
- [4.3 Thành phần cũ (components/common)](#43-thành-phần-cũ-componentscommon)
- [4.4 Thành phần nghiệp vụ (components/modules)](#44-thành-phần-nghiệp-vụ-componentsmodules)
- [4.5 Mẫu giao diện lặp lại chưa tách thành phần](#45-mẫu-giao-diện-lặp-lại-chưa-tách-thành-phần)

## 4.1 Bảng tổng hợp

| Thành phần | File | Số lần dùng | Ghi chú nhanh |
|---|---|---:|---|
| Text | `mobile/src/components/ui/Text.tsx` | 655 (67 file) | Mọi chữ |
| Icon | `mobile/src/components/ui/Icon.tsx` | 167 | Ionicons bọc token |
| Button | `mobile/src/components/ui/Button.tsx` | 83 (35 file) | 6 variant × 3 size |
| Input | `mobile/src/components/ui/Input.tsx` | 52 | |
| Badge | `mobile/src/components/ui/Badge.tsx` | 39 | 7 tone |
| Skeleton (+ RestaurantRowSkeleton 2, TileSkeleton 3) | `mobile/src/components/ui/Skeleton.tsx` | 28 | |
| EmptyState | `mobile/src/components/ui/States.tsx` | 28 | |
| ListRow | `mobile/src/components/ui/ListRow.tsx` | 27 | |
| AppImage | `mobile/src/components/ui/AppImage.tsx` | 24 | |
| Divider | `mobile/src/components/ui/ListRow.tsx` | 20 | |
| LoadingSpinner | `mobile/src/components/ui/States.tsx` | 20 | Màu viết cứng |
| FilterChip | `mobile/src/components/ui/Chip.tsx` | 19 | |
| IconButton | `mobile/src/components/ui/IconButton.tsx` | 18 | |
| TopBar | `mobile/src/components/ui/TopBar.tsx` | 18 | |
| BottomSheet | `mobile/src/components/ui/Overlays.tsx` | 18 | |
| TabHeader | `mobile/src/components/ui/TabHeader.tsx` | 17 | |
| Gradient | `mobile/src/components/ui/Gradient.tsx` | 16 | |
| ConfirmDialog | `mobile/src/components/ui/Overlays.tsx` | 15 | |
| OrderStatusBadge | `mobile/src/components/ui/Badge.tsx` | 11 | |
| Avatar | `mobile/src/components/ui/Avatar.tsx` | 8 | |
| CountBadge | `mobile/src/components/ui/Badge.tsx` | 8 | |
| SearchBar | `mobile/src/components/ui/SearchBar.tsx` | 7 | |
| ErrorState | `mobile/src/components/ui/States.tsx` | 7 | |
| FormInput | `mobile/src/components/ui/Input.tsx` | 7 | react-hook-form |
| FloatingTabBar | `mobile/src/components/ui/FloatingTabBar.tsx` | 4 | 1 lần mỗi navigator |
| ChoiceRow / ChoiceGroup | `mobile/src/components/ui/Choice.tsx` | 4 / 3 | |
| QuantityStepper | `mobile/src/components/ui/QuantityStepper.tsx` | 3 | |
| InfoChip | `mobile/src/components/ui/Chip.tsx` | 3 | |
| SectionHeader | `mobile/src/components/ui/SectionHeader.tsx` | 2 | Chỉ HomeScreen |
| FilterBar | `mobile/src/components/ui/Admin.tsx` | 1 | Chỉ OrderHistoryScreen |
| Toast (`useToast`) | `mobile/src/components/ui/Overlays.tsx` | (hook, nhiều màn) | |
| **Card** | `mobile/src/components/ui/Card.tsx` | **0** | Không dùng |
| **StatCard** | `mobile/src/components/ui/Admin.tsx` | **0** | Không dùng |
| **SheetHandle** | `mobile/src/components/ui/Overlays.tsx` | **0** | Không dùng |

## 4.2 Chi tiết từng thành phần kit

### Text — `mobile/src/components/ui/Text.tsx`

| Mục | Nội dung |
|---|---|
| Prop | `variant` (display, title, headline, body-lg, body, caption, micro, price), `weight` (regular, medium, semibold, bold), `tone`, `className`, + prop của RN Text |
| tone → lớp | default `text-ink` · secondary `text-ink-secondary` · muted `text-ink-muted` · inverse `text-ink-inverse` · brand **`text-brand-600`** · accent `text-accent-700` · danger `text-danger` · success `text-success-strong` · warning `text-warning-strong` |
| Mặc định | `maxFontSizeMultiplier` 1.4 |
| Hạn chế ghi nhận trong mã | OwnerStatsScreen dòng 100: không ghi đè được cỡ chữ qua `className` |

### Button — `mobile/src/components/ui/Button.tsx`

| Variant | Nền (dòng 12–18) | Chữ/biểu tượng |
|---|---|---|
| primary | `bg-brand-500 active:bg-brand-600` | inverse (trắng) |
| secondary | `bg-brand-50 border border-brand-100 active:bg-brand-100` | brand (#0E9FB3) |
| outline | `bg-surface border border-line active:bg-canvas-subtle` | default |
| ghost | `bg-transparent active:bg-brand-50` | brand |
| danger | `bg-danger active:opacity-80` | inverse |
| dangerSoft | `bg-danger-soft border border-danger/20 active:opacity-80` | danger |

| Size | Lớp (dòng 49–51) | Chữ |
|---|---|---|
| sm | `h-button-sm px-3 rounded-sm gap-1` (32px) + hitSlop 6 | caption semibold |
| md | `h-button-md px-4 rounded-md gap-2` (40px) | body semibold |
| lg | `h-button-lg px-5 rounded-md gap-2` (48px) | body-lg semibold |

Trạng thái: `disabled` → `opacity-50`; `loading` → ActivityIndicator; `leftIcon`/`rightIcon` (Icon sm khi size sm, md còn lại).

### IconButton — `mobile/src/components/ui/IconButton.tsx`

Variant: surface, subtle, brand, ghost, scrim, glass. Size: sm `w-8` (hitSlop 6), md `w-10` (hitSlop 2), lg `w-12`. Hình tròn.

### Icon — `mobile/src/components/ui/Icon.tsx`

Ionicons. Size: xs 14 · sm 16 · md 20 · lg 24 · xl 32. Tone ánh xạ sang `palette` (brand → brand-500 `#1EB9CE`, rating → `#FFB400`…). Nhiều nơi vẫn gọi `<Ionicons>` trực tiếp với `size` số và `color` hex (xem 07 §13.6).

### Badge, CountBadge, OrderStatusBadge — `mobile/src/components/ui/Badge.tsx`

| Badge tone | Nền | Chữ | Biểu tượng |
|---|---|---|---|
| discount | `bg-accent-500` | inverse | inverse |
| brand | `bg-brand-500` | inverse | inverse |
| neutral | `bg-canvas-subtle` | secondary | secondary |
| success | `bg-success-soft` | success | success |
| warning | `bg-warning-soft` | warning | **accent** (cam) — khác tone chữ |
| danger | `bg-danger-soft` | danger | danger |
| scrim | `bg-scrim` | inverse | **rating** (vàng) |

Size `sm` (chữ 11, dùng đè trên ảnh nhỏ) và `md`. **CountBadge**: `h-5 min-w-5 rounded-full border-2 border-surface bg-danger px-1`. **OrderStatusBadge**: xem [03](03-nhan-trang-thai.md).

### Chip — `mobile/src/components/ui/Chip.tsx`

- **InfoChip**: tone voucher, freeship, neutral, success, danger; `h-6 rounded-sm`. Tone `freeship` thực tế dùng để hiện phí giao "Từ X đ" (RestaurantCards).
- **FilterChip**: `h-chip rounded-full border shadow-card`; đang chọn `border-brand-500 bg-brand-50`.

### Card — `mobile/src/components/ui/Card.tsx`

Variant `elevated` / `flat`, `rounded-lg p-3`. **Không màn nào dùng**; các màn tự dựng thẻ bằng `View` + `rounded-xl/2xl bg-surface shadow-card`.

### Input, FormInput — `mobile/src/components/ui/Input.tsx`

`h-button-lg rounded-md`, nền `canvas-subtle`; focus viền brand; lỗi nền `danger-soft` + chữ lỗi; có nút ẩn/hiện mật khẩu. Có `label`. `FormInput` bọc `Controller` của react-hook-form (Login, Register).

### SearchBar — `mobile/src/components/ui/SearchBar.tsx`

`lg`: `h-search-lg rounded-xl border shadow-card` (52px). `md`: `h-search rounded-md bg-canvas-subtle` (40px). Có chế độ chỉ là nút bấm (HomeScreen mở Search).

### ListRow, Divider — `mobile/src/components/ui/ListRow.tsx`

ListRow: `min-h-touch`; vòng biểu tượng `h-touch` nền `canvas-subtle`; tiêu đề body-lg, phụ đề body; chevron phải. Divider: biến thể inset `ml-14`.

### TopBar — `mobile/src/components/ui/TopBar.tsx`

`bg-canvas px-4 pb-2`, hàng `h-topbar` (56px). Kiểu `center` tiêu đề headline; kiểu `large` tiêu đề display. **Không tự xử lý vùng an toàn** (màn phải bọc SafeAreaView).

### TabHeader — `mobile/src/components/ui/TabHeader.tsx`

Gradient `tabHeader`, `rounded-b-2xl`, SafeAreaView cạnh trên, `px-4 pb-5 pt-3`; tiêu đề variant display màu inverse, prop `titleLines`; phụ đề body `opacity-80`; khe `trailing`.

### SectionHeader — `mobile/src/components/ui/SectionHeader.tsx`

Tiêu đề variant title, icon brand, nút "xem tất cả". Chỉ dùng ở HomeScreen (2 lần).

### States — `mobile/src/components/ui/States.tsx`

| Thành phần | Cấu trúc |
|---|---|
| EmptyState | Vòng `h-24 bg-brand-50`, icon 44 brand, tiêu đề headline, mô tả body-lg, nút secondary; biến thể `card` bọc Gradient `empty` |
| ErrorState | Vòng `danger-soft`, icon `cloud-offline`, "Đã xảy ra lỗi", nút "Thử lại" |
| LoadingSpinner | ActivityIndicator màu viết cứng `"#1EB9CE"` + `message` |

### Skeleton — `mobile/src/components/ui/Skeleton.tsx`

Reanimated, nhấp nháy opacity 450ms, tôn trọng `useReducedMotion`. Thêm `RestaurantRowSkeleton`, `TileSkeleton`.

### Avatar — `mobile/src/components/ui/Avatar.tsx`

sm `w-8` · md `w-10` · lg `w-14` · xl `w-20`; nền `brand-100`, chữ viết tắt (tone brand) khi không có ảnh.

### AppImage — `mobile/src/components/ui/AppImage.tsx`

Skeleton khi tải, icon dự phòng khi lỗi, dùng `StyleSheet.absoluteFill`. Dùng `Image` của RN (không có expo-image).

### QuantityStepper — `mobile/src/components/ui/QuantityStepper.tsx`

Nút `w-7` hoặc `w-8` (28–32px) có hitSlop 8.

### Choice — `mobile/src/components/ui/Choice.tsx`

`ChoiceRow` (radio/checkbox; hộp `rounded-[6px]`), `ChoiceGroup`. Dùng ở DishOptionSheet, RoleUpgradeRequestScreen.

### Admin — `mobile/src/components/ui/Admin.tsx`

`StatCard` (không dùng), `FilterBar` (1 lần, OrderHistoryScreen).

### Overlays — `mobile/src/components/ui/Overlays.tsx`

| Thành phần | Cấu trúc |
|---|---|
| BottomSheet | `Modal` animationType slide; lớp `bg-scrim`; khung `rounded-t-2xl max-h-[90%]` |
| ConfirmDialog | `Modal` fade; khung `rounded-xl p-5`; nút `outline` + `primary` hoặc `danger` |
| Toast / useToast | Reanimated FadeInDown 200 / FadeOutDown 150, `ReduceMotion.System`; vị trí `bottom-24`, `rounded-full bg-ink`; tự ẩn 2600ms |
| SheetHandle | Không dùng |

### FloatingTabBar — `mobile/src/components/ui/FloatingTabBar.tsx`

Xem [mục 7 trong tài liệu chính](../UI_DESIGN_INVENTORY.md#7-khung-điều-hướng).

## 4.3 Thành phần cũ (components/common)

| File | Kiểu | Được dùng bởi |
|---|---|---|
| `AppImage.tsx` | StyleSheet, màu `#EA580C`, `#EE4D2D` | Chỉ `modules/RestaurantCard.tsx` |
| `AppMapView.tsx` / `.native.tsx` / `.web.tsx` | StyleSheet, marker màu hex | **Đang dùng**: OrderTrackingScreen, DriverDeliveryDetailScreen |
| `Badge.tsx` | StyleSheet, 9 mã hex riêng | Không |
| `Button.tsx` | StyleSheet | Không (đã kiểm tay) |
| `Card.tsx` | StyleSheet | Chỉ `modules/RestaurantCard.tsx` |
| `EmptyState.tsx`, `Input.tsx`, `LoadingSpinner.tsx` | StyleSheet | Không |

## 4.4 Thành phần nghiệp vụ (components/modules)

| Thành phần | File | Dùng ở |
|---|---|---|
| CartItem | `modules/CartItem.tsx` | CartScreen |
| OrderTimeline | `modules/OrderTimeline.tsx` (StyleSheet) | **Không dùng** |
| RestaurantCard | `modules/RestaurantCard.tsx` (StyleSheet, TouchableOpacity) | **Không dùng** |
| RestaurantRow | `modules/restaurant/RestaurantCards.tsx` dòng 116 | HomeScreen, SearchScreen |
| RestaurantTile, RestaurantCardVertical | cùng file, dòng 46, 78 | **Không dùng** |
| DishRow, DishPrice | `modules/restaurant/DishRow.tsx` | RestaurantDetailScreen |
| DishOptionSheet | `modules/restaurant/DishOptionSheet.tsx` | RestaurantDetailScreen, CartScreen |
| DishCard, DishTile | `modules/home/DishCard.tsx` | HomeScreen |
| BannerCarousel, BannerSkeleton | `modules/home/BannerCarousel.tsx` | HomeScreen |
| FeaturedCarousel | `modules/home/FeaturedCarousel.tsx` | HomeScreen |
| ChatNotifier | `modules/chat/ChatNotifier.tsx` | App.tsx |
| ChatOrderCard | `modules/chat/ChatOrderCard.tsx` | ChatScreen |
| adminShared (SectionCard, InfoRow, RoleBadge, ROLE_META, RESTAURANT_STATUS_META, REQUEST_STATUS_META, describeAudit) | `modules/admin/adminShared.tsx` | Các màn admin, RoleUpgradeRequestScreen |
| DriverVerifySheet, RoleRequestsSheet, UserActivitySheet | `modules/admin/` | AdminUsersScreen |
| AssignOwnerSheet, RestaurantDetailSheet | `modules/admin/` | AdminRestaurantsScreen |

Nội dung các sheet: xem [04 §6.39](04-man-hinh.md#639-bảng-trượt-hộp-thoại-và-thành-phần-cấp-màn).

## 4.5 Mẫu giao diện lặp lại chưa tách thành phần

Các khối được dựng lại bằng `View` + lớp ở nhiều màn, không có thành phần chung. Vị trí lấy từ comment trong mã.

| Mẫu | Xuất hiện ở (file:dòng) | Khác biệt quan sát được |
|---|---|---|
| Lộ trình 2 điểm Quán → Khách (2 chấm + đường nối + địa chỉ) | DriverAvailableOrdersScreen 327–381; DriverDeliveriesScreen 178–223; DriverDeliveryDetailScreen 684–740 | Nhãn khác nhau: "Lấy tại quán / Giao đến khách", "Lấy món tại / Giao đến", "ĐIỂM LẤY MÓN (QUÁN) / ĐIỂM GIAO MÓN (KHÁCH HÀNG)" |
| Khối tài chính chuyến (thu nhập + tiền cần thu) | DriverAvailableOrdersScreen 389; DriverDeliveriesScreen 247; DriverDeliveryDetailScreen 814 | Chữ khác: "Thu nhập thực nhận / Tiền thu của khách", "Thu nhập chuyến / Tiền thu khách", "THU NHẬP THỰC NHẬN (CÔNG GIAO) / TIỀN CẦN THU TỪ KHÁCH HÀNG"; trả online: "Khách đã trả qua thẻ (0 ₫)", "Đã thanh toán (0 ₫)", "0 ₫ (Khách đã trả trực tuyến)" |
| Thanh tiến trình trạng thái đơn | OrderTrackingScreen 204–300; DriverDeliveriesScreen 118; DriverDeliveryDetailScreen 618; (OrderTimeline module không dùng) | Số bước và nhãn khác nhau (xem 03) |
| Thẻ đánh giá + phản hồi | DriverReviewsScreen 75–137; OwnerReviewsScreen 84–169; RestaurantDetailScreen 401; OrderTrackingScreen 399 | Nhãn phản hồi: "Phản hồi của bạn:", "Phản hồi của quán:", "Phản hồi từ quán:", "Phản hồi từ nhà hàng:" |
| Ô chỉ số (số lớn + nhãn) | AdminDashboardScreen 229; OwnerMenuScreen (Tổng món/Đang bán/Hết món); OwnerRestaurantScreen 373; OwnerStatsScreen 127; DriverAvailableOrdersScreen 534; DriverProfileScreen 278 | `StatCard` của kit có sẵn nhưng không dùng |
| Biểu đồ cột theo ngày | DriverProfileScreen 294; OwnerStatsScreen 141 | Hai cách vẽ riêng |
| Phân đoạn chọn (segmented) | DriverDeliveriesScreen 300; DriverProfileScreen 254; OwnerStatsScreen 58 (chọn khoảng) | Chiều cao khác nhau (h-9 ở DriverProfile) |
| Hộp cảnh báo (icon + chữ trên nền soft) | DriverAvailableOrdersScreen 475, 502; OwnerRestaurantScreen 257; DriverVehicleScreen 171; CheckoutScreen 393; DriverDeliveryDetailScreen 536 | Nền warning-soft, danger-soft, `danger-soft/20` khác nhau |
| Nút liên hệ Gọi / Nhắn | DriverDeliveryDetailScreen 742; OrderTrackingScreen (thẻ tài xế 308); OwnerOrdersScreen (Nhắn khách / Nhắn tài xế) | Pressable tự dựng ở tài xế, Button ở chủ quán |
| Đầu trang tự dựng (không TopBar/TabHeader) | SearchScreen 134; AddressPickerScreen 252; OwnerStatsScreen 58; LoginScreen 107; RegisterScreen 109; HomeScreen 284 | |
| Logo chữ Z | LoginScreen 130; RegisterScreen 130; SplashLogo 113 | Kích thước khác: `h-[72px] rounded-[22px]`, `h-16 rounded-[20px]`, `h-24 rounded-[28px]` |
| Hàng thông tin nhãn–giá trị | InfoRow (adminShared) vs các hàng tự dựng ở DriverProfileScreen, OwnerRestaurantScreen, CheckoutScreen | |
| Ô nhập không dùng Input của kit | AddAddressScreen (placeholder thay nhãn), RatingScreen, ChatScreen 267, AddressPickerScreen | |
| Huy hiệu nhỏ tự dựng (View + Text) | DriverDeliveryDetailScreen ("Giữ lại từ tiền thu hộ", "TIỀN MẶT COD"); AddressManagementScreen ("Mặc định", "Đang chọn"); AddAddressScreen | Không dùng Badge |
