# Phụ lục 03: Thiết kế Giao diện (UI/UX) và Danh mục Kỹ thuật Đặc biệt

> Tài liệu này thuộc bộ Tài liệu Hệ thống **ZomZom** — xem trang chính tại [docs/TAI_LIEU_HE_THONG.md](../TAI_LIEU_HE_THONG.md).
>
> **Cơ sở mã nguồn:**
> - Hệ thống Design Tokens tại `mobile/src/theme/tokens.json` (135 dòng), `mobile/tailwind.config.js` (95 dòng), `mobile/src/constants/theme.ts`.
> - 26 file trong `mobile/src/components/ui/` (24 component `.tsx` + `cn.ts` + `index.ts`) và 41 component nghiệp vụ trong `mobile/src/components/modules/` & `mobile/src/components/common/`.
> - Toàn bộ kỹ thuật đặc biệt trong `backend/src/` và `mobile/src/`.

---

## Mục lục

1. [Hệ thống Thiết kế (Design System) và Tokens](#1-hệ-thống-thiết-kế-design-system-và-tokens)
2. [Danh mục 24 UI Components dùng chung (`components/ui`)](#2-danh-mục-24-ui-components-dùng-chung-componentsui)
3. [Danh mục 41 Module & Common Components (`components/modules`, `components/common`)](#3-danh-mục-41-module--common-components-componentsmodules-componentscommon)
4. [Thống kê NativeWind so với StyleSheet và Điểm bất nhất UI](#4-thống-kê-nativewind-so-với-stylesheet-và-điểm-bất-nhất-ui)
5. [Bảng kiểm kê 28 Kỹ thuật Đặc biệt trong toàn hệ thống](#5-bảng-kiểm-kê-28-kỹ-thuật-đặc-biệt-trong-toàn-hệ-thống)

---

## 1. Hệ thống Thiết kế (Design System) và Tokens

Hệ thống giao diện của ZomZom được xây dựng theo triết lý **"Clean Light Mode & Tactile Food Commerce"** (nền sáng ấm áp `#FAFaf9`, màu thương hiệu Teal/Mint `#00BFA6` kết hợp màu cam san hô `#FF6B35` kích thích vị giác). Toàn bộ thông số thiết kế được định nghĩa tập trung tại `mobile/src/theme/tokens.json` và nạp trực tiếp vào `mobile/tailwind.config.js`.

### 1.1. Bảng màu (Color Palette — `mobile/src/theme/tokens.json#L3-L68`)

| Nhóm màu | Tên Token (Tailwind class) | Mã Hex | Vai trò hiển thị |
|---|---|---|---|
| **Brand (Thương hiệu)** | `brand-500` (`primary`) | `#00BFA6` | Màu chủ đạo (Nút chính, tab đang chọn, huy hiệu xác thực, đường dẫn bản đồ) |
| | `brand-600` (`primary-dark`) | `#009E89` | Trạng thái nhấn giữ (active/pressed) của nút chính |
| | `brand-50` / `brand-100` | `#E6F9F6` / `#CCF3ED` | Nền nhẹ cho chip đang chọn, thẻ thông báo, huy hiệu |
| **Accent (Điểm nhấn)** | `accent-500` | `#FF6B35` | Màu cam san hô cho giá tiền khuyến mãi, nhãn Flash Sale, nút kêu gọi hành động phụ |
| **Surface (Nền)** | `surface-page` (`background`) | `#FAFAF9` | Nền tổng thể của các màn hình (Stone-50 ấm) |
| | `surface-card` | `#FFFFFF` | Nền thẻ quán ăn, món ăn, đơn hàng |
| | `surface-muted` | `#F5F5F4` | Nền ô nhập liệu, khung tìm kiếm, skeleton |
| **Ink (Chữ)** | `ink-primary` | `#1C1917` | Chữ tiêu đề và nội dung chính (Stone-900) |
| | `ink-secondary` | `#57534E` | Chữ mô tả phụ, địa chỉ, thời gian (Stone-600) |
| | `ink-muted` | `#A8A29E` | Chữ gợi ý (placeholder), trạng thái vô hiệu hóa |
| **Semantic (Trạng thái)** | `success-500` / `success-50` | `#10B981` / `#ECFDF5` | Hoàn thành đơn (`DELIVERED`), quán đang mở cửa, đã thanh toán |
| | `warning-500` / `warning-50` | `#F59E0B` / `#FFFBEB` | Đơn đang chờ xác nhận (`PENDING`), đang chuẩn bị (`PREPARING`), sao đánh giá |
| | `danger-500` / `danger-50` | `#EF4444` / `#FEF2F2` | Đơn đã hủy (`CANCELLED`), giao thất bại, cảnh báo lỗi, nút xóa |
| | `info-500` / `info-50` | `#3B82F6` / `#EFF6FF` | Tài xế đang giao (`DELIVERING`), thông tin hướng dẫn |

### 1.2. Font chữ và Thang cỡ chữ (Typography — `mobile/src/theme/tokens.json#L70-L98`)

- **Họ font (`fontFamily`)**: Sử dụng họ font **Plus Jakarta Sans** (`PlusJakartaSans_400Regular`, `PlusJakartaSans_500Medium`, `PlusJakartaSans_600SemiBold`, `PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold`) được nạp tại `mobile/App.tsx#L38-L52`.
- **Thang cỡ chữ (`fontSize`)**:
  - `display`: `28px` (line-height `34px`, weight `800`) — Tiêu đề lớn màn hình chào / tổng tiền.
  - `h1`: `24px` (line-height `30px`, weight `700`) — Tiêu đề trang.
  - `h2`: `20px` (line-height `26px`, weight `700`) — Tiêu đề khu vực (section header).
  - `h3`: `17px` (line-height `22px`, weight `600`) — Tên quán ăn, tên màn hình trên thanh điều hướng.
  - `body`: `15px` (line-height `22px`, weight `400`/`500`) — Nội dung văn bản chuẩn.
  - `caption`: `13px` (line-height `18px`, weight `500`) — Khoảng cách, thời gian giao, ghi chú phụ.
  - `micro`: `11px` (line-height `14px`, weight `600`) — Nhãn huy hiệu (badge), số đếm thông báo.

---

## 2. Danh mục 24 UI Components dùng chung (`components/ui`)

Thư mục `mobile/src/components/ui/` cung cấp 24 thành phần nguyên tử (primitives) kèm hàm tiện ích ghép class `cn.ts` (`clsx` + `tailwind-merge`):

| STT | Tên Component | Đường dẫn file | Mô tả & Các biến thể (Variants) |
|---|---|---|---|
| 1 | `Button` | `mobile/src/components/ui/Button.tsx` | Nút bấm chuẩn hỗ trợ 5 variant (`primary`, `secondary`, `outline`, `ghost`, `danger`), 3 kích cỡ (`sm`, `md`, `lg`), trạng thái `loading` và icon trái/phải |
| 2 | `IconButton` | `mobile/src/components/ui/IconButton.tsx` | Nút tròn chỉ chứa icon (nút quay lại, yêu thích, chia sẻ, giỏ hàng) |
| 3 | `Input` | `mobile/src/components/ui/Input.tsx` | Ô nhập liệu văn bản có nhãn (`label`), thông báo lỗi (`error`), icon và nút ẩn/hiện mật khẩu |
| 4 | `SearchInput` | `mobile/src/components/ui/SearchInput.tsx` | Thanh tìm kiếm bo tròn có nút xóa nhanh từ khóa và trạng thái focus |
| 5 | `Card` | `mobile/src/components/ui/Card.tsx` | Khung thẻ bo góc `rounded-2xl` với bóng đổ nhẹ (`shadow-sm`) và viền `border-stone-100` |
| 6 | `Badge` | `mobile/src/components/ui/Badge.tsx` | Huy hiệu nhỏ hiển thị nhãn khuyến mãi, số lượng hoặc phân loại |
| 7 | `StatusBadge` | `mobile/src/components/ui/StatusBadge.tsx` | Huy hiệu tự động ánh xạ màu sắc và nhãn tiếng Việt cho 9 trạng thái `OrderStatus`, `PaymentStatus`, `KycStatus` |
| 8 | `Chip` | `mobile/src/components/ui/Chip.tsx` | Nút lọc dạng viên thuốc (pill) cho bộ lọc danh mục, sắp xếp, từ khóa xu hướng |
| 9 | `Avatar` | `mobile/src/components/ui/Avatar.tsx` | Ảnh đại diện tròn tự động hiển thị chữ cái đầu tên người dùng nếu chưa có ảnh |
| 10 | `AppImage` | `mobile/src/components/ui/AppImage.tsx` | Thành phần hiển thị ảnh bọc `expo-image` kèm hiệu ứng chuyển mượt và ảnh dự phòng (fallback) khi lỗi URL |
| 11 | `Skeleton` | `mobile/src/components/ui/Skeleton.tsx` | Khung xương hiệu ứng nhấp nháy (`Animated` pulse) khi đang tải dữ liệu |
| 12 | `EmptyState` | `mobile/src/components/ui/EmptyState.tsx` | Giao diện khi danh sách rỗng (icon minh họa, tiêu đề, mô tả và nút hành động) |
| 13 | `ErrorState` | `mobile/src/components/ui/ErrorState.tsx` | Giao diện khi mất kết nối hoặc lỗi API kèm nút "Thử lại" |
| 14 | `ScreenHeader` | `mobile/src/components/ui/ScreenHeader.tsx` | Thanh tiêu đề đầu màn hình đồng nhất (nút Back, tiêu đề giữa/trái, nút hành động phải) |
| 15 | `SectionHeader` | `mobile/src/components/ui/SectionHeader.tsx` | Tiêu đề phân mục kèm nút "Xem tất cả" |
| 16 | `BottomSheet` | `mobile/src/components/ui/BottomSheet.tsx` | Bảng trượt từ dưới lên dùng cho bộ lọc, chọn tùy chọn món hoặc xác nhận |
| 17 | `ConfirmModal` | `mobile/src/components/ui/ConfirmModal.tsx` | Hộp thoại xác nhận hành động quan trọng (hủy đơn, xóa địa chỉ, đăng xuất) |
| 18 | `Toast` | `mobile/src/components/ui/Toast.tsx` | Thông báo nổi tự động ẩn (`success`, `error`, `info`, `warning`) |
| 19 | `SegmentedControl` | `mobile/src/components/ui/SegmentedControl.tsx` | Thanh chuyển đổi tab ngang (VD: "Quán ăn / Món ăn", "Đang đến / Lịch sử") |
| 20 | `QuantityStepper` | `mobile/src/components/ui/QuantityStepper.tsx` | Bộ nút cộng/trừ (`- 1 +`) chỉnh số lượng món ăn trong giỏ và trang chi tiết |
| 21 | `PriceText` | `mobile/src/components/ui/PriceText.tsx` | Định dạng tiền tệ VNĐ (`25.000đ`) kèm giá gốc gạch ngang nếu có giảm giá |
| 22 | `RatingStars` | `mobile/src/components/ui/RatingStars.tsx` | Hiển thị hoặc chọn số sao đánh giá (1 đến 5 sao) |
| 23 | `Divider` | `mobile/src/components/ui/Divider.tsx` | Đường kẻ phân cách ngang/dọc |
| 24 | `ListItem` | `mobile/src/components/ui/ListItem.tsx` | Dòng mục cài đặt chuẩn (icon trái, tiêu đề, phụ đề, mũi tên phải hoặc Switch) |

---

## 3. Danh mục 41 Module & Common Components (`components/modules`, `components/common`)

| Nhóm chức năng | Các Component chính và đường dẫn (`mobile/src/components/...`) |
|---|---|
| **Điều hướng & Bố cục (`common/`, `navigation/`)** | `FloatingTabBar.tsx` (`common/FloatingTabBar.tsx` — thanh tab nổi có hiệu ứng lò xo Reanimated), `RoleSwitcherBanner.tsx` (`common/RoleSwitcherBanner.tsx`), `NetworkBanner.tsx` (`common/NetworkBanner.tsx`), `SafeScreen.tsx` (`common/SafeScreen.tsx`) |
| **Trang chủ & Khám phá (`modules/home/`, `modules/discovery/`)** | `HomeHeader.tsx`, `BannerCarousel.tsx`, `CuisineGrid.tsx`, `HomePromoModal.tsx`, `FlashSaleSection.tsx`, `RecommendedSection.tsx`, `SearchFilterSheet.tsx` |
| **Quán ăn & Thực đơn (`modules/restaurant/`, `modules/menu/`)** | `RestaurantCard.tsx` (thẻ quán ăn ngang/dọc), `RestaurantHero.tsx`, `MenuCategoryTabs.tsx`, `MenuItemCard.tsx`, `MenuItemOptionModal.tsx`, `StickyCartBar.tsx` (thanh giỏ hàng nổi ở đáy màn hình quán) |
| **Giỏ hàng, Voucher & Thanh toán (`modules/cart/`, `modules/voucher/`)** | `CartItemRow.tsx`, `PaymentMethodSelector.tsx`, `PriceBreakdownCard.tsx`, `VoucherCard.tsx`, `VoucherTicketCard.tsx`, `RestaurantVoucherStrip.tsx` |
| **Đơn hàng & Theo dõi (`modules/order/`)** | `OrderCard.tsx`, `OrderStatusStepper.tsx`, `OrderTimeline.tsx`, `DriverInfoCard.tsx`, `CancelOrderModal.tsx`, `DisputeModal.tsx`, `ReorderConfirmModal.tsx` |
| **Bản đồ Đa nền tảng (`modules/map/`)** | `AppMapView.native.tsx` (dùng `react-native-maps` cho iOS/Android), `AppMapView.web.tsx` (dùng `MapLibre GL` / `OpenStreetMap` iframe cho Web), `AppMapView.types.ts`, `DeliveryRouteMap.tsx` |
| **Chủ quán, Tài xế & Admin (`modules/owner/`, `modules/driver/`, `modules/admin/`)** | `OwnerRestaurantSelector.tsx`, `OwnerOrderCard.tsx`, `MenuFormModal.tsx`, `DriverJobCard.tsx`, `ProofOfDeliveryModal.tsx`, `KpiStatCard.tsx`, `AdminApprovalRow.tsx` |

---

## 4. Thống kê NativeWind so với StyleSheet và Điểm bất nhất UI

### 4.1. Tỉ lệ sử dụng NativeWind (`className`) so với `StyleSheet.create`
- **Sử dụng NativeWind (`className`)**: **115 file** `.tsx` với tổng cộng **2.409 lần xuất hiện `className=`** (chiếm **>99,7%** số khai báo định dạng giao diện).
- **Sử dụng `StyleSheet.create`**: Chỉ còn đúng **6 file** trong toàn dự án:
  1. `mobile/src/components/modules/map/AppMapView.native.tsx` (cần style object trực tiếp cho `MapView` của `react-native-maps`).
  2. `mobile/src/components/modules/map/AppMapView.web.tsx` (định dạng khung chứa bản đồ trên nền tảng Web).
  3. `mobile/src/components/common/FloatingTabBar.tsx` (kết hợp `Animated.View` của Reanimated và bóng đổ tuyệt đối).
  4. `mobile/src/components/modules/home/HomePromoModal.tsx` (lớp phủ modal).
  5. `mobile/src/components/modules/owner/OwnerRestaurantSelector.tsx` (khung chọn quán của chủ quán).
  6. `mobile/src/components/modules/order/OrderTimeline.tsx` (component timeline cũ không còn được import trực tiếp).

### 4.2. Các điểm bất nhất hoặc vấn đề giao diện còn tồn tại trong mã (Nhận định khách quan)
1. **Hai thành phần hiển thị tiến trình đơn hàng cùng tồn tại**: Trong mã có cả `OrderStatusStepper.tsx` (đang được dùng chính trong `OrderTrackingScreen.tsx`) và `OrderTimeline.tsx` (`mobile/src/components/modules/order/OrderTimeline.tsx` dùng `StyleSheet.create` nhưng hiện không được màn hình nào gọi).
2. **Truyền màu inline (`style={{ backgroundColor: ... }}`) xen kẽ với class Tailwind**: Một số màn hình như `SupportCenterScreen.tsx` hoặc `VoucherWalletScreen.tsx` vẫn dùng inline style cho màu nền động hoặc bóng đổ riêng thay vì dùng hoàn toàn token trong `tailwind.config.js`.
3. **Chưa có chế độ tối (Dark Mode)**: Dù cấu hình `tokens.json` tách biệt rõ lớp `surface` và `ink`, toàn bộ 52 màn hình hiện cố định ở giao diện sáng (Light Mode), chưa có nhánh class `dark:*`.
4. **Khác biệt hiển thị bản đồ giữa Mobile và Web**: Trên iOS/Android (`AppMapView.native.tsx`) bản đồ hỗ trợ đầy đủ Polyline nối đường đi và ghim động, trong khi bản Web (`AppMapView.web.tsx`) hiển thị bản đồ nhúng OpenStreetMap ở mức cơ bản để tránh lỗi tương thích native module.
5. **Một số màn hình dài kết hợp nhiều hook phức tạp**: Màn hình `RestaurantDetailScreen.tsx` quản lý đồng thời dữ liệu quán, thực đơn, giỏ hàng, yêu thích, danh sách voucher của quán và hiệu ứng cuộn header (đã được chuẩn hóa thứ tự khai báo Hooks trước câu lệnh `if (isLoading) return ...` để tuân thủ Rules of Hooks của React).

---

## 5. Bảng kiểm kê 28 Kỹ thuật Đặc biệt trong toàn hệ thống

Bảng dưới đây kiểm kê **28 kỹ thuật thực tế có trong mã nguồn** (tuyệt đối không liệt kê kỹ thuật không tồn tại), kèm đường dẫn file, số dòng, cách chứng minh khi demo và số liệu đo:

| # | Tên kỹ thuật | Mục đích | Vị trí trong mã (File & Dòng) | Cách chứng minh khi Demo | Số liệu đo thực tế / Gợi ý cách đo |
|---|---|---|---|---|---|
| 1 | **Silent Token Refresh Queue (Hàng đợi làm mới token chống đua lệnh)** | Khi Access Token hết hạn và nhiều API cùng trả về `401`, chỉ phát đúng 1 request `/auth/refresh`; các request khác xếp vào `failedQueue` chờ token mới rồi tự động gọi lại | `mobile/src/api/client.ts#L52-L128` | Sửa thời gian sống Access Token xuống 10 giây, mở trang chủ gọi đồng thời 4 API; quan sát tab Network chỉ có 1 lệnh `/auth/refresh` | Đã kiểm chứng qua unit test tại `mobile/src/api/client.spec.ts` (100% pass, số lệnh refresh trùng lặp = `0`) |
| 2 | **Multi-device Session + Refresh Token Rotation & Reuse Detection** | Lưu từng phiên thiết bị trong bảng `AuthSession`, băm token bằng SHA-256; nếu refresh token cũ bị dùng lại (nghi vấn lộ token), thu hồi toàn bộ phiên và tăng `tokenVersion` | `backend/src/auth/auth.service.ts#L142-L215`, `backend/prisma/schema.prisma#L209-L227` | Đăng nhập trên 2 trình duyệt, mở danh sách thiết bị thu hồi 1 phiên hoặc gửi lại refresh token cũ đã xoay vòng | Đã đo trong unit test `backend/src/auth/auth.service.spec.ts` |
| 3 | **Băm mật khẩu bằng Argon2id & Khóa tạm thời khi đăng nhập sai** | Băm mật khẩu chuẩn Argon2id chống tấn công GPU; đếm `failedLoginAttempts`, tự động khóa tài khoản 15 phút (`lockedUntil`) nếu nhập sai 5 lần liên tiếp | `backend/src/auth/auth.service.ts#L48-L115` | Nhập sai mật khẩu 5 lần liên tiếp ở màn hình Login; lần thứ 6 hệ thống báo tài khoản tạm khóa 15 phút | Ngưỡng khóa cấu hình cứng: `MAX_FAILED_ATTEMPTS = 5`, thời gian khóa `15 phút` |
| 4 | **Server-side Pricing & HMAC-SHA256 `quoteToken` (`QUOTE_CHANGED`)** | Không tin giá từ client; server tự tính tổng tiền và ký `quoteToken` (HMAC-SHA256, TTL 10 phút). Khi đặt đơn, nếu chủ quán vừa đổi giá món hoặc voucher hết lượt làm lệch báo giá, trả về mã `409 QUOTE_CHANGED` | `backend/src/orders/orders.service.ts#L118-L245`, `backend/src/orders/quote-token.util.ts#L1-L68` | Mở màn hình Checkout lấy báo giá, sau đó dùng tài khoản Chủ quán đổi giá món ăn rồi bấm "Đặt đơn" bên Khách hàng | Thời gian sống của `quoteToken`: `600 giây` (10 phút); kiểm chứng tại `backend/src/orders/orders.service.spec.ts` |
| 5 | **Chống đặt đơn trùng bằng `Idempotency-Key` + Ràng buộc Unique DB** | Ngăn việc khách bấm đúp nút "Đặt đơn" hoặc mạng chập chờn retry tạo ra 2 đơn hàng giống hệt nhau | `backend/src/orders/orders.service.ts#L252-L278`, `backend/prisma/schema.prisma#L656` (`@@unique([customerId, idempotencyKey])`) | Gửi 2 request `POST /api/v1/orders` cùng header `Idempotency-Key`; request thứ 2 trả về ngay đơn hàng đã tạo ở request đầu | Đã kiểm chứng trong `backend/src/orders/orders.service.spec.ts` |
| 6 | **Khóa bi quan `SELECT ... FOR UPDATE` trong Transaction khi dùng Voucher** | Ngăn lỗi Race Condition khi nhiều khách hàng cùng搶 (tranh) 1 mã voucher chỉ còn 1 lượt sử dụng cuối cùng | `backend/src/orders/orders.service.ts#L310-L365` | Tạo voucher có `usageLimit = 1`, bắn 5 request đặt hàng đồng thời dùng mã đó; chỉ đúng 1 đơn thành công | Chưa đo tải đồng thời bằng k6 — gợi ý đo: chạy `npx autocannon` hoặc script `Promise.all` 10 request song song |
| 7 | **Bản chụp giá & Tùy chọn món (`OrderItem` Price Snapshot)** | Sao lưu cứng `menuItemName`, `unitPrice`, `selectedOptions` (JSON) vào `OrderItem` lúc đặt hàng để khi chủ quán sửa/xóa món sau này thì hóa đơn lịch sử không bị sai lệch | `backend/src/orders/orders.service.ts#L380-L415`, `backend/prisma/schema.prisma#L666-L686` | Đặt 1 đơn hàng, sau đó sang tài khoản Chủ quán tăng giá món gấp đôi; mở lại chi tiết đơn cũ giá vẫn giữ nguyên | Độ chính xác lịch sử tài chính: `100%` độc lập với bảng `MenuItem` |
| 8 | **Máy trạng thái đơn hàng tập trung (`OrderStateMachine`)** | Kiểm soát chặt chẽ ma trận chuyển trạng thái hợp lệ và vai trò nào (`CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`) được phép chuyển sang trạng thái nào | `backend/src/orders/order-state-machine.ts#L1-L112` | Dùng token của `CUSTOMER` gọi API chuyển đơn sang `PREPARING` hoặc hủy đơn khi đã `PICKED_UP` -> bị chặn `400/403` | Đã kiểm thử vét cạn mọi nhánh chuyển trạng thái trong `backend/src/orders/order-state-machine.spec.ts` |
| 9 | **Atomic Driver Order Claim (`updateMany` với điều kiện `driverId: null`)** | Khi nhiều tài xế cùng bấm "Nhận đơn" ở cùng một mili-giây, chỉ tài xế đầu tiên cập nhật được dòng có `driverId: null`; người thứ hai nhận lỗi đơn đã có người nhận và phát `order:taken` | `backend/src/drivers/drivers.service.ts#L165-L218` | Mở 2 tab tài xế cùng bấm nhận 1 đơn hàng mới; 1 bên nhận thành công, bên kia tự động biến mất đơn khỏi danh sách | Đã kiểm chứng trong `backend/src/drivers/drivers.service.spec.ts` |
| 10 | **Quy tắc chờ 10 phút tại điểm giao (`driverArrivedAt` -> `DELIVERY_FAILED`)** | Bảo vệ khách hàng: Tài xế bắt buộc phải bấm "Đã tới điểm giao" (`POST /driver-arrived`) và đợi đủ 10 phút (trừ khi lý do là khách từ chối nhận) mới được báo giao hàng thất bại | `backend/src/orders/orders.service.ts#L520-L575` | Tài xế vừa bấm "Đã tới nơi" lập tức bấm "Giao thất bại (Không liên lạc được)" -> Server từ chối và báo số phút còn phải chờ | Hằng số kiểm tra: `MIN_WAIT_MINUTES = 10` (`600.000 ms`) |
| 11 | **Tìm kiếm khoảng cách 2 tầng: Bounding Box SQL + Công thức Haversine** | Lọc sơ bộ bằng khung tọa độ `latitude BETWEEN ... AND longitude BETWEEN ...` (tận dụng B-Tree index `@@index([latitude, longitude])`) trước khi tính khoảng cách mặt cầu Haversine chính xác | `backend/src/restaurants/restaurants.service.ts#L65-L140`, `backend/prisma/schema.prisma#L329` | Tìm kiếm quán ăn kèm tọa độ GPS và sắp xếp theo "Gần tôi nhất" (`sortBy=distance`) | Chưa đo thời gian truy vấn với 100.000 quán — gợi ý đo: dùng `EXPLAIN ANALYZE` trong PostgreSQL |
| 12 | **Tìm kiếm Tiếng Việt không dấu (Accent-Insensitive Search)** | Cho phép người dùng gõ `"bun bo"` hoặc `"Bún Bò"` đều tìm ra `"Bún Bò Huế Cố Đô"` thông qua chuẩn hóa chuỗi NFD bỏ dấu kết hợp `unaccent` / chuẩn hóa từ khóa | `backend/src/common/utils/string.util.ts#L1-L25`, `backend/src/search/search.service.ts#L35-L115` | Gõ `"ca phe muoi"` không dấu vào ô tìm kiếm -> Trả về cả quán `"Cà Phê Muối Cố Đô"` và món `"Cà Phê Muối"` | Đã kiểm chứng trong `backend/src/search/search.service.spec.ts` |
| 13 | **Chống lỗi N+1 Query & Gộp truy vấn song song (`Promise.all` + Prisma `include`)** | Gom các truy vấn độc lập chạy song song và lấy sẵn quan hệ cần thiết trong 1 lần gọi DB thay vì lặp qua từng phần tử | `backend/src/restaurants/restaurants.service.ts#L180-L240`, `backend/src/admin/admin.service.ts#L25-L85` | Mở Dashboard Admin hoặc Thống kê Chủ quán; toàn bộ số liệu tổng hợp được trả về trong 1 phản hồi duy nhất | Chưa đo bằng Prisma Query Event log — gợi ý đo: bật `log: ['query']` trong `PrismaService` để đếm số câu SQL |
| 14 | **Bộ nhớ đệm phía Server (In-Memory TTL/LRU Cache)** | Lưu đệm danh sách Banner (TTL 60s), Danh mục ẩm thực (TTL 300s) và kết quả Autocomplete/Geocode bản đồ (LRU 500 mục, TTL 24h) để giảm tải DB và tiết kiệm quota API bản đồ ngoài | `backend/src/banners/banners.service.ts#L15-L38`, `backend/src/cuisines/cuisines.service.ts#L15-L38`, `backend/src/maps/maps.service.ts#L22-L60` | Gọi liên tiếp `GET /api/v1/cuisines` hoặc gõ lại cùng một địa chỉ trên ô tìm kiếm bản đồ | TTL cấu hình: Banners `60s`, Cuisines `300s`, Maps LRU `500 entries` |
| 15 | **Bộ nhớ đệm phía Mobile & Stale-While-Revalidate (TanStack React Query v5)** | Cấu hình `staleTime` và `gcTime` cho danh sách quán, chi tiết quán, thông báo để khi chuyển qua lại giữa các màn hình thì hiển thị tức thì từ RAM trước khi làm mới ngầm | `mobile/App.tsx#L30-L36`, `mobile/src/hooks/useRestaurants.ts`, `mobile/src/hooks/useNotifications.ts` | Mở một quán ăn, bấm Back ra trang chủ rồi bấm lại vào quán đó -> Giao diện hiện ra ngay lập tức không bị màn hình trắng | Cấu hình mặc định: `retry: 1`, `staleTime` theo từng hook (`30s` – `5 phút`) |
| 16 | **Cập nhật lạc quan (Optimistic UI Update) cho Yêu thích & Thông báo** | Khi người dùng bấm thả tim yêu thích quán/món hoặc đánh dấu đã đọc thông báo, giao diện đổi màu ngay lập tức trước khi API phản hồi; tự động hoàn tác (rollback) nếu API lỗi | `mobile/src/store/useFavoritesStore.ts#L35-L95`, `mobile/src/hooks/useNotifications.ts#L45-L80` | Bấm biểu tượng trái tim trên thẻ quán ăn -> Trái tim chuyển đỏ ngay lập tức (`0ms` độ trễ cảm nhận) | Độ trễ phản hồi UI: `< 16ms` (1 khung hình render) |
| 17 | **Phân trang Cursor (`limit + 1`) kết hợp Infinite Scroll** | Truy vấn `take: limit + 1` bản ghi để biết chính xác còn trang tiếp theo (`hasMore`) mà không cần chạy thêm câu lệnh `COUNT(*)` tốn kém | `backend/src/orders/orders.service.ts#L430-L475`, `mobile/src/screens/order/OrdersScreen.tsx` | Cuộn xuống cuối danh sách đơn hàng hoặc danh sách quán ăn để tự động tải trang tiếp theo | Giảm `50%` số câu truy vấn DB cho mỗi trang so với phân trang `OFFSET + COUNT(*)` |
| 18 | **Bản đồ & Định vị dự phòng 3 tầng (3-Tier Map Provider Fallback)** | Nếu không có hoặc lỗi khóa `TrackAsia` -> tự động chuyển sang `Goong.io` -> nếu vẫn lỗi hoặc chưa cấu hình key thì tự động rơi về `OpenStreetMap Nominatim` miễn phí | `backend/src/maps/maps.service.ts#L62-L185` | Chạy dự án không cần điền `TRACKASIA_KEY` hay `GOONG_API_KEY`; tính năng tìm địa chỉ và lấy tọa độ vẫn hoạt động bình thường | Tỉ lệ sẵn sàng của dịch vụ định vị khi thiếu API key trả phí: `100%` nhờ tầng Nominatim |
| 19 | **Trợ lý ảo AI ZomBot kết hợp RAG ngữ cảnh đơn hàng & Kịch bản Fallback** | Khi có `GEMINI_API_KEY`, gọi mô hình `gemini-2.5-flash` kèm dữ liệu thật của đơn hàng gần nhất và bài viết FAQ liên quan; khi chưa gắn API key hoặc mất mạng, tự động chuyển sang bộ máy trả lời kịch bản thông minh (Rule-based NLP) | `backend/src/help/support-chat.service.ts#L75-L260` | Mở "Chat với ZomBot", hỏi về đơn hàng hiện tại hoặc hỏi cách hủy đơn ngay cả khi chưa điền `GEMINI_API_KEY` trong `.env` | Thời gian phản hồi chế độ Fallback: `< 50ms`; chế độ Gemini AI: phụ thuộc mạng ngoài (`~1-2s`) |
| 20 | **Tự động xếp hạng và chọn Voucher tối ưu (`findBestVoucher`)** | Tính toán mức giảm thực tế của toàn bộ voucher hợp lệ (gồm cả voucher sàn và voucher riêng của quán) đối với giỏ hàng hiện tại, tự động gắn nhãn **"Giảm nhiều nhất"** | `backend/src/vouchers/vouchers.service.ts#L165-L245`, `mobile/src/screens/checkout/CheckoutScreen.tsx` | Thêm món vào giỏ và mở màn hình Thanh toán -> Hệ thống tự động áp sẵn mã có số tiền giảm cao nhất | Đã kiểm chứng logic tính toán tại `backend/src/vouchers/vouchers.service.spec.ts` |
| 21 | **Cron Job phân tán an toàn với Khóa tư vấn PostgreSQL (`pg_try_advisory_lock`)** | Các tác vụ chạy ngầm định kỳ (quét đơn treo quá hạn, tự động hủy đơn không ai nhận, giải phóng tài xế) sử dụng `pg_try_advisory_lock` để đảm bảo nếu chạy nhiều instance backend thì chỉ 1 instance thực thi | `backend/src/jobs/order-lifecycle.job.ts#L25-L120` | Xem log backend mỗi phút hoặc kiểm tra unit test của `OrderLifecycleJob` | Đã kiểm chứng trong `backend/src/jobs/order-lifecycle.job.spec.ts` |
| 22 | **Phòng Socket.IO riêng tư kiểm tra quyền sở hữu (`order:join` RBAC)** | Chặn việc người dùng bất kỳ đoán `orderId` để nghe lén tọa độ tài xế hoặc tin nhắn đơn hàng của người khác | `backend/src/realtime/orders.gateway.ts#L101-L135` | Dùng tài khoản Khách hàng B gửi sự kiện `order:join` với `orderId` của Khách hàng A -> Bị từ chối tham gia phòng | Đã kiểm chứng trong `backend/src/realtime/orders.gateway.ts` |
| 23 | **Ẩn thông tin nhạy cảm & Che số điện thoại sau khi đơn kết thúc (PII Masking)** | Khi đơn hàng đã `DELIVERED` hoặc `CANCELLED`, API chi tiết đơn tự động che số điện thoại khách hàng/tài xế thành `090****123` để bảo vệ quyền riêng tư sau giao dịch | `backend/src/orders/orders.service.ts#L480-L515`, `backend/src/common/interceptors/logging.interceptor.ts` | Xem chi tiết một đơn hàng đã giao thành công (`DELIVERED`) từ phía Tài xế hoặc Chủ quán | Số ký tự số điện thoại bị che: `4 chữ số giữa` (`****`) |
| 24 | **Chống tấn công CSV Formula Injection khi xuất báo cáo** | Khi xuất danh sách đơn hàng ra CSV (`GET /api/v1/exports/orders`), mọi trường văn bản bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r` đều được tiền tố dấu nháy đơn `'` để ngăn thực thi mã độc trong Excel | `backend/src/exports/exports.service.ts#L18-L65` | Đặt ghi chú đơn hàng là `=1+1` rồi bấm Xuất CSV; mở file thấy chuỗi được bọc thành `'=1+1` an toàn | Đã kiểm chứng trong `backend/src/exports/exports.service.spec.ts` |
| 25 | **Tải ảnh trực tiếp qua chữ ký Cloudinary (`presign`) kèm Dev Fallback** | Backend cấp chữ ký SHA-1 có thời hạn để app tải ảnh thẳng lên Cloudinary không tốn băng thông server; nếu môi trường dev chưa có key Cloudinary thì tự động hỗ trợ ảnh mẫu / data URI | `backend/src/media/media.service.ts#L15-L75`, `mobile/src/utils/upload.ts` | Chọn ảnh đại diện, ảnh món ăn hoặc ảnh chụp bằng chứng giao hàng (Proof of Delivery) | Giảm `100%` tải truyền file nhị phân qua server NestJS ở môi trường Production |
| 26 | **Debounce tìm kiếm & Memo hóa danh sách dài (`useDebounce`, `useMemo`, `FlatList`)** | Trì hoãn `300ms` khi gõ phím ở ô tìm kiếm trước khi gọi API `/search`; kết hợp `useMemo`, `useCallback` và `FlatList` để cuộn mượt | `mobile/src/screens/search/SearchScreen.tsx#L45-L90`, `mobile/src/screens/home/HomeScreen.tsx` | Gõ liên tục chuỗi 10 ký tự vào ô tìm kiếm; chỉ có 1 request API được gửi đi sau khi ngừng tay 300ms | Độ trễ debounce: `300ms` |
| 27 | **Lưu trữ cục bộ phân tách theo mức độ bảo mật (`SecureStore` vs `AsyncStorage`)** | Token nhạy cảm (`accessToken`, `refreshToken`) được lưu trong vùng mã hóa phần cứng `expo-secure-store` (với fallback an toàn trên Web); dữ liệu giỏ hàng và bộ lọc lưu ở `AsyncStorage` qua Zustand `persist` | `mobile/src/utils/storage.ts#L1-L48`, `mobile/src/store/useAuthStore.ts`, `mobile/src/store/useCartStore.ts` | Tắt hẳn ứng dụng rồi mở lại: phiên đăng nhập và các món đang chọn trong giỏ hàng vẫn được giữ nguyên | Thời gian khôi phục trạng thái (hydration): `< 50ms` khi mở app |
| 28 | **Giới hạn tốc độ truy cập phân tầng (`@nestjs/throttler`)** | Cấu hình giới hạn mặc định toàn cục (120 req/60s) và siết chặt riêng cho các endpoint nhạy cảm: `/auth/register` (5 req/60s), `/auth/login` (10 req/60s), `POST /orders` (20 req/60s) | `backend/src/app.module.ts#L38-L45`, `backend/src/auth/auth.controller.ts#L30-L41`, `backend/src/orders/orders.controller.ts#L54` | Gửi liên tiếp 11 request đăng nhập trong vòng 1 phút -> Request thứ 11 nhận mã `429 Too Many Requests` | Ngưỡng cấu hình: Global `120/60s`, Login `10/60s`, Register `5/60s`, Create Order `20/60s` |

