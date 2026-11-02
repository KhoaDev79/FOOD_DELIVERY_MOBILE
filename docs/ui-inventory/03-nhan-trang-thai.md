# Phụ lục 03 — Nhãn, huy hiệu và trạng thái (mục 5)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md)

## Mục lục

- [5.1 Nơi tạo huy hiệu, chip, nhãn](#51-nơi-tạo-huy-hiệu-chip-nhãn)
- [5.2 Trạng thái đơn hàng](#52-trạng-thái-đơn-hàng)
- [5.3 Vai trò người dùng](#53-vai-trò-người-dùng)
- [5.4 Trạng thái quán, yêu cầu, hồ sơ xe](#54-trạng-thái-quán-yêu-cầu-hồ-sơ-xe)
- [5.5 Phương thức thanh toán](#55-phương-thức-thanh-toán)
- [5.6 Lý do huỷ / giao thất bại](#56-lý-do-huỷ--giao-thất-bại)
- [5.7 Cùng trạng thái, khác tên hoặc màu](#57-cùng-trạng-thái-khác-tên-hoặc-màu)

## 5.1 Nơi tạo huy hiệu, chip, nhãn

| Cách tạo | File định nghĩa | Số nơi dùng | Ghi chú |
|---|---|---:|---|
| `Badge` (7 tone) | `mobile/src/components/ui/Badge.tsx` | 39 | Huy hiệu chung |
| `OrderStatusBadge` | `mobile/src/components/ui/Badge.tsx` dòng 84–91 | 11 | Màu riêng theo trạng thái |
| `CountBadge` | `mobile/src/components/ui/Badge.tsx` dòng 71 | 8 | Số đếm đỏ |
| `InfoChip` | `mobile/src/components/ui/Chip.tsx` | 3 | Phí giao, voucher… |
| `FilterChip` | `mobile/src/components/ui/Chip.tsx` | 19 | Bộ lọc |
| `RoleBadge` | `mobile/src/components/modules/admin/adminShared.tsx` | các màn admin | Dựa trên ROLE_META |
| `ORDER_STATUS_CONFIG` (`color`, `bgColor`, `label`) | `mobile/src/utils/orderStatus.ts` dòng 9–51 | nguồn nhãn của OrderStatusBadge, OrderTracking | Màu từ bảng cũ `constants/colors.ts` + hex |
| Pill tự dựng (View + Text) | nhiều màn | — | OrderTrackingScreen dòng 230–240; DriverAvailableOrdersScreen dòng 322; DriverDeliveryDetailScreen dòng 212, 862 (theo bản gốc); AddressManagementScreen ("Mặc định", "Đang chọn"); AddAddressScreen dòng 218, 240 |
| Bảng nhãn cục bộ trong màn | xem 5.2–5.4 | — | FILTERS, STEP_LABELS, TRACKING_STEPS, ROLE_LABELS, SIDE_LABEL |

## 5.2 Trạng thái đơn hàng

Enum backend: `PENDING`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`, `DELIVERED`, `DELIVERY_FAILED`, `CANCELLED`.

### 5.2.1 Bảng nhãn chung và màu

| Enum | `ORDER_STATUS_CONFIG.label` (utils/orderStatus.ts) | OrderStatusBadge nền / chữ | `ORDER_STATUS_CONFIG` color/bgColor (bảng cũ) | `ORDER_STEPS` (dòng 59–64) |
|---|---|---|---|---|
| PENDING | Chờ xác nhận | `warning-soft` / `warning-strong` | warning / `#FEF3C7` | Chờ quán nhận |
| CONFIRMED | Đã nhận đơn | `info-soft` / `info-strong` | info / `#DBEAFE` | Đã xác nhận |
| PREPARING | Đang chuẩn bị món | `violet-soft` / `violet-strong` | (bảng cũ) / `#CCFBF1` (suy luận theo thứ tự hex) | Đang làm món |
| READY_FOR_PICKUP | Chờ tài xế lấy | `brand-100` / `brand-800` | (bảng cũ) | Chờ lấy |
| PICKED_UP | Đang giao hàng | `brand-50` / `brand-700` | (bảng cũ) | Đang giao |
| DELIVERED | Giao thành công | `success-soft` / `success-strong` | success / `#D1FAE5` | Hoàn thành |
| DELIVERY_FAILED | Giao thất bại | `danger-soft` / `danger-strong` | danger / `#FEE2E2` | — |
| CANCELLED | Đã **hủy** | `danger-soft` / `danger-strong` | danger / `#FEE2E2` | — |

Ghi chú: `ORDER_STATUS_CONFIG.color/bgColor` dùng bảng màu cũ (cam đỏ, `#10B981`…) trong khi OrderStatusBadge dùng token mới — hai hệ màu cho cùng trạng thái. Chưa xác nhận màn nào còn đọc `color/bgColor`.

### 5.2.2 Nhãn theo từng màn / vai trò

| Enum | Khách: OrderTracking bước (dòng 18–22) | Khách: OrderTracking pill (dòng 232–240) | Khách: OrderHistory lọc (dòng 33–36) | Chủ quán: OwnerOrders lọc (dòng 31–39) | Tài xế: DriverDeliveries (dòng 26) | Tài xế: DriverDeliveryDetail (dòng 49–53) | Tài xế: DriverAvailable chip (dòng 322) | Admin: AdminOrders lọc (dòng 35–43) |
|---|---|---|---|---|---|---|---|---|
| PENDING | Chờ duyệt | Chờ duyệt | Đang xử lý | Chờ nhận | — | — | — | Chờ xác nhận |
| CONFIRMED | Đã nhận | Đã nhận | Đang xử lý | Đã nhận | Đã nhận | Đã nhận chuyến | Quán đang làm món | Đã xác nhận |
| PREPARING | Chuẩn bị | Đang làm món | Đang xử lý | Đang chuẩn bị | Đang nấu | Quán đang làm món | Quán đang làm món | Đang chuẩn bị |
| READY_FOR_PICKUP | (gộp vào bước Chuẩn bị, dòng 31–33) | **Hoàn thành** (rơi vào nhánh mặc định) | Đang xử lý | Chờ tài xế | Sẵn sàng | Sẵn sàng lấy món | Món đã sẵn sàng | Chờ tài xế |
| PICKED_UP | Đang giao | Đang giao | Đang xử lý | Đang giao | Đang giao | Đang đi giao | — | Đang giao |
| DELIVERED | Đã giao | (không hiện: chỉ hiện khi chưa kết thúc — suy luận) | Hoàn thành | Hoàn thành | Đã giao | Đã giao thành công | — | Đã giao |
| DELIVERY_FAILED | khối đỏ "Giao hàng không thành công" | — | Đã huỷ / Thất bại | Giao thất bại | — | "Chuyến giao không thành công" | — | Giao thất bại |
| CANCELLED | khối đỏ "Đơn hàng đã **hủy**" | — | Đã huỷ / Thất bại | Đã **huỷ** | — | "Đơn hàng này đã bị **huỷ**" | — | Đã **huỷ** |

Trên cùng một thẻ ở OrderTrackingScreen (dòng 220–240), tiêu đề hiển thị `ORDER_STATUS_CONFIG.label` và pill bên cạnh hiển thị bộ nhãn thứ hai, ví dụ PREPARING: "Đang chuẩn bị món" + "Đang làm món"; READY_FOR_PICKUP: "Chờ tài xế lấy" + "Hoàn thành".

Nút thao tác của chủ quán theo trạng thái (OwnerOrdersScreen dòng 60–96): "Nhận đơn", "Bắt đầu chuẩn bị", "Món đã sẵn sàng", "Từ chối", "Huỷ đơn", "Báo hết món".

## 5.3 Vai trò người dùng

| Enum | ROLE_META (adminShared.tsx dòng 14–17) | ChatScreen ROLE_LABELS (dòng 57–60) | ChatNotifier (dòng 23–25) | InboxScreen SIDE_LABEL (dòng 32–34) | LoginScreen DEMO_ACCOUNTS (dòng 44–47) | AdminUsers lọc (dòng 41–45) |
|---|---|---|---|---|---|---|
| CUSTOMER | Khách hàng · tone **neutral** · person-outline | Khách hàng · tone **brand** | Khách hàng | Khách hàng | Khách hàng · nền `brand-50` | Khách hàng |
| RESTAURANT_OWNER | **Chủ quán** · warning · storefront-outline | **Quán ăn** · warning | Quán ăn | Quán ăn (RESTAURANT) | Chủ quán · nền `accent-50` | Chủ quán |
| DRIVER | Tài xế · success · bicycle-outline | Tài xế · success | **Tài xế giao hàng** | Tài xế | Tài xế · nền **`info-soft`** | Tài xế |
| ADMIN | Quản trị viên · tone **danger** · shield-checkmark-outline | Quản trị viên · tone **neutral** | — | — | **Quản trị** · nền **`violet-soft`** | Quản trị viên |

Nhãn tab hồ sơ theo vai trò: khách "Tài khoản", tài xế "Tài xế", chủ quán "Cửa hàng", admin "Hệ thống".

## 5.4 Trạng thái quán, yêu cầu, hồ sơ xe

| Bảng | Enum → nhãn · tone | File |
|---|---|---|
| RESTAURANT_STATUS_META | PENDING_APPROVAL → Chờ duyệt · warning; ACTIVE → Đã duyệt · success; SUSPENDED → Tạm khoá · danger | `mobile/src/components/modules/admin/adminShared.tsx` dòng 8–10 |
| REQUEST_STATUS_META | PENDING → Chờ duyệt · warning; APPROVED → Đã duyệt · success; REJECTED → Từ chối · danger | cùng file, dòng 25–27 |
| DRIVER_STATUS_META | PENDING → Chờ duyệt xe · warning; APPROVED → Xe đã duyệt · success; REJECTED → Từ chối xe · danger; SUSPENDED → Tạm khoá xe · danger | `mobile/src/components/modules/admin/DriverVerifySheet.tsx` dòng 11–14 |
| Trạng thái quán phía chủ quán | "Quán chưa hiển thị với khách" / "Quán đang bị tạm khoá / từ chối duyệt" (hộp cảnh báo) | `mobile/src/screens/owner/OwnerRestaurantScreen.tsx` dòng 257 |
| Trạng thái quán phía khách | "Đã đóng cửa", "Ngoài vùng giao hàng" (RestaurantCards); "Quán đã đóng" (DishCard); "Đang mở cửa" (bộ lọc Search) | `components/modules/restaurant/RestaurantCards.tsx`, `components/modules/home/DishCard.tsx`, `screens/search/SearchScreen.tsx` |
| Món | "Tạm hết" (DishRow), "Tạm hết món" / "Hết món" (OwnerMenu), "Hết món" (Checkout) | |
| Trực tuyến tài xế | công tắc Trực tuyến / Ngoại tuyến; "Bạn đang ngoại tuyến" | DriverAvailableOrdersScreen dòng 447 |

## 5.5 Phương thức thanh toán

Checkout chỉ cho COD (CheckoutScreen dòng 510), nhưng nhiều màn vẫn rẽ nhánh VNPAY/online:

| Nơi | COD | Không phải COD |
|---|---|---|
| CheckoutScreen | "Thanh toán tiền mặt khi nhận hàng" / "Thanh toán trực tiếp cho tài xế khi nhận món (COD)" | — |
| OrderHistoryScreen dòng 88 | Tiền mặt | **VNPAY** |
| OwnerOrdersScreen dòng 569 | Tiền mặt | **VNPay** |
| ChatOrderCard dòng 79 | Tiền mặt | Đã trả online |
| DriverAvailableOrdersScreen | (số tiền thu) | Khách đã trả qua thẻ (0 ₫) |
| DriverDeliveriesScreen | (số tiền thu) | Đã thanh toán (0 ₫) / Không thu tiền |
| DriverDeliveryDetailScreen dòng 862 | TIỀN MẶT COD | ĐÃ THANH TOÁN; "0 ₫ (Khách đã trả trực tuyến)" |
| DriverProfileScreen dòng 324 | Tiền mặt COD | — |

## 5.6 Lý do huỷ / giao thất bại

`mobile/src/utils/orderStatus.ts`: `CANCEL_REASON_LABELS`, `FAILED_DELIVERY_REASON_LABELS`, `formatOrderEndReason()` — dùng chung cho OrderTracking, DriverDeliveryDetail, OwnerOrders, AdminOrders (theo comment "Lý do huỷ / giao thất bại").

## 5.7 Cùng trạng thái, khác tên hoặc màu

| Nội dung | Các biến thể | Nơi |
|---|---|---|
| PENDING | Chờ xác nhận · Chờ quán nhận · Chờ duyệt · Chờ nhận · Đang xử lý | orderStatus.ts, OrderTracking, OwnerOrders, AdminOrders, OrderHistory |
| CONFIRMED | Đã nhận đơn · Đã xác nhận · Đã nhận · Đã nhận chuyến | như trên + màn tài xế |
| PREPARING | Đang chuẩn bị món · Đang làm món · Chuẩn bị · Đang chuẩn bị · Đang nấu · Quán đang làm món | |
| READY_FOR_PICKUP | Chờ tài xế lấy · Chờ lấy · Chờ tài xế · Sẵn sàng · Sẵn sàng lấy món · Món đã sẵn sàng · **Hoàn thành** (pill OrderTracking) | |
| PICKED_UP | Đang giao hàng · Đang giao · Đang đi giao | |
| DELIVERED | Giao thành công · Hoàn thành · Đã giao · Đã giao thành công | |
| CANCELLED | Đã hủy / Đã huỷ (hai cách đặt dấu) | "hủy": orderStatus.ts dòng 51, OrderTracking, CartScreen, HomeScreen, RestaurantDetailScreen ("Hủy"); "huỷ": OwnerOrders, AdminOrders, OrderHistory, DriverDeliveryDetail |
| Màu CONFIRMED | `info` (xanh dương) ở OrderStatusBadge; pill OrderTracking luôn `bg-brand-50` + tone brand cho mọi trạng thái | Badge.tsx dòng 85; OrderTracking dòng 230 |
| Màu vai trò CUSTOMER | neutral (admin) / brand (chat) / nền brand-50 (login) | 5.3 |
| Màu vai trò ADMIN | danger (admin) / neutral (chat) / violet (login) | 5.3 |
| Màu vai trò DRIVER | success (admin, chat) / info (login) | 5.3 |
| Badge tone warning | chữ `warning-strong` nhưng biểu tượng tone `accent` (cam) | Badge.tsx dòng 25, 34 |
| Thanh toán không phải COD | VNPAY · VNPay · Đã trả online · ĐÃ THANH TOÁN · Khách đã trả qua thẻ · Khách đã trả trực tuyến · Đã thanh toán | 5.5 |
| Phản hồi đánh giá | Phản hồi của bạn · Phản hồi của quán · Phản hồi từ quán · Phản hồi từ nhà hàng | DriverReviews, OwnerReviews, RestaurantDetail, OrderTracking |
