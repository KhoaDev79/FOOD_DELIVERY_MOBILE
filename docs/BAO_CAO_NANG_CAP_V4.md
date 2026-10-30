# BÁO CÁO NÂNG CẤP CHỨC NĂNG ZOMZOM V4 — ĐƯA NGHIỆP VỤ VỀ CHUẨN THỰC TẾ (COD)

**Dự án:** ZomZom Food Delivery System  
**Phiên bản:** V4 Business & Technical Modernization  
**Thời gian hoàn thành:** 31/10/2026  
**Nhánh thực hiện:** `redesign/nativewind-ui`  
**Cơ sở dữ liệu:** PostgreSQL 16 (`food_delivery_db` / port 5433)

---

## 1. Tóm Tắt Kết Quả Triển Khai Theo 5 Trụ Cột & Bảng 3.8

### 1.1. Trụ Cột A: Bảo Mật, Danh Tính & Kiểm Duyệt Quán
| Mục | Nội dung yêu cầu | Trạng thái | Chi tiết triển khai |
|---|---|---|---|
| A1 | Thu hồi phiên tức thì khi khoá tài khoản hoặc đổi vai trò | **ĐÃ HOÀN THÀNH** | Tạo `AuthStateService` lưu trạng thái `isActive` và `role` vào bộ nhớ in-memory kèm TTL 30s. `JwtStrategy` kiểm tra chéo mỗi request; nếu vi phạm trả về 401 ngay lập tức. `OrdersGateway.disconnectUser(userId)` ngắt kết nối WebSocket Socket.IO tức thời. |
| A2 | Kiểm duyệt nhà hàng & an toàn xoá | **ĐÃ HOÀN THÀNH** | Thêm enum `RestaurantStatus` (`PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`). Quán mới tạo hoặc sửa các trường nhạy cảm (`name`, `address`, toạ độ) tự động chuyển sang `PENDING_APPROVAL`. Chỉ quán `ACTIVE` mới hiển thị ở màn hình khách hàng và được bật mở cửa nhận đơn. Chặn xoá cứng quán đã phát sinh đơn (`BadRequestException`). Quản trị viên phê duyệt qua `PATCH /admin/restaurants/:id/approve`, `reject`, `status`. Toàn bộ hành động đều được ghi vào bảng `AuditLog`. |
| A3 | Đăng ký luôn là CUSTOMER | **ĐÃ HOÀN THÀNH** | Loại bỏ hoàn toàn trường `role` khỏi `RegisterDto`. Mọi tài khoản mới đăng ký đều mặc định là `CUSTOMER`. Khách hàng muốn mở quán hoặc làm tài xế phải gửi yêu cầu qua `POST /role-requests` để Quản trị viên xét duyệt. |

### 1.2. Trụ Cột B: Định Tuyến, Khoảng Cách & Định Giá Đơn Hàng
| Mục | Nội dung yêu cầu | Trạng thái | Chi tiết triển khai |
|---|---|---|---|
| B1 | Adapter khoảng cách Goong + Cache + Fallback | **ĐÃ HOÀN THÀNH** | `MapsService.getRoadDistance` gọi Goong Matrix API với profile xe máy (`vehicle=bike`), cache kết quả 24 giờ qua `LruCache` (giới hạn 10.000 khoá). Khi thiếu API key hoặc lỗi mạng, tự động fallback sang `Haversine × ROAD_DISTANCE_FALLBACK_FACTOR (1.3)` có gắn cờ `ESTIMATED` và cache 5 phút. `FallbackMapProvider` tích hợp `RateLimiter` 1.100ms và User-Agent tuân thủ OSM Nominatim. |
| B2 | Báo giá phía máy chủ `POST /orders/quote` | **ĐÃ HOÀN THÀNH** | Endpoint `/orders/quote` tính toán `subtotal`, `deliveryFee` (theo biểu phí có phụ phí cao điểm `DELIVERY_PEAK_MULTIPLIER` trong các khung giờ cao điểm `DELIVERY_PEAK_WINDOWS`), làm tròn lên bội số 1.000đ. Trả về `quoteToken` mã hoá JWT/HMAC-SHA256 chứa hash giỏ hàng và thời gian hết hạn (`QUOTE_TTL_MINUTES = 10`). |
| B3 | Đặt đơn bằng Quote & Idempotency Key | **ĐÃ HOÀN THÀNH** | `POST /orders` yêu cầu `quoteToken` và header `Idempotency-Key` (UUID). Nếu phát hiện gian lận giá hoặc sai lệch giỏ hàng trả về 400; nếu báo giá quá hạn hoặc giá món tại quán thay đổi trả về 409 `QUOTE_CHANGED` để client xác nhận lại. Trùng `Idempotency-Key` trong 10 phút trả về đơn đã tạo trước đó mà không trừ kho lặp lại. Chặn khách hàng có trên 3 đơn giao thất bại trong 30 ngày. |
| B4 | Nguồn địa chỉ duy nhất trên Mobile | **ĐÃ HOÀN THÀNH** | Tạo `resolveActiveDeliveryAddress` trong `useDeliveryAddressStore`. Quy tắc ưu tiên: Địa chỉ đã chọn ở Trang chủ / Sổ địa chỉ -> Địa chỉ mặc định -> Toạ độ GPS (nếu được cấp quyền). Khi bị từ chối GPS, hiển thị trạng thái yêu cầu chọn địa chỉ thủ công, xoá bỏ hoàn toàn toạ độ giả lập `DEFAULT_COORDS` (Bến Thành). Màn hình `CheckoutScreen` đồng bộ trực tiếp địa chỉ này. |
| B5 | Gỡ bỏ tính phí ở Client | **ĐÃ HOÀN THÀNH** | Xoá toàn bộ `calculateDeliveryFee`, `DELIVERY_FEE_CONFIG`, `isPeakHour` trong `mobile/src/utils/fee.ts`. Mọi màn hình Mobile (`CheckoutScreen`, `RestaurantDetailScreen`, `DriverAvailableOrdersScreen`) lấy phí giao hàng trực tiếp từ API. |

### 1.3. Trụ Cột C: Quy Trình COD, Sổ Quỹ Tài Xế & Giao Thất Bại
| Mục | Nội dung yêu cầu | Trạng thái | Chi tiết triển khai |
|---|---|---|---|
| C1 | Luồng thanh toán COD duy nhất | **ĐÃ HOÀN THÀNH** | Tạm ngừng thanh toán trực tuyến VNPay: `POST /payments/vnpay/:orderId/url` trả về 400 `"Thanh toán trực tuyến tạm ngừng, vui lòng chọn hình thức COD"`. Webhook `handleIpn` nếu nhận kết quả sau khi đơn bị huỷ sẽ chuyển trạng thái `REFUNDED` và phát socket ngoài transaction. Gỡ bỏ màn hình/deep link kết quả VNPay trên mobile. |
| C2 | Máy trạng thái đơn hàng V4 | **ĐÃ HOÀN THÀNH** | Xây dựng bộ điều khiển máy trạng thái `order-state-machine.ts` độc lập. Phân quyền chặt chẽ từng tác nhân (`CUSTOMER`, `RESTAURANT`, `DRIVER`, `ADMIN`, `SYSTEM`). Bổ sung trạng thái `DELIVERY_FAILED`. Bắt buộc gửi lý do hợp lệ khi huỷ (`cancelReason`) hoặc báo giao thất bại (`failedReason`). |
| C3 | Tài xế trả đơn `release` | **ĐÃ HOÀN THÀNH** | `POST /orders/:id/release` cho phép tài xế trả lại đơn trước khi lấy hàng (tối đa 3 lần/ngày theo `MAX_ORDER_RELEASE_PER_DAY`). Trạng thái chuyển về `READY_FOR_PICKUP`, gỡ tài xế và phát lại `order:available` cho các tài xế khác. |
| C4 | Sổ quỹ công nợ COD `DriverLedger` | **ĐÃ HOÀN THÀNH** | Quản lý tiền mặt COD thu hộ và thu nhập qua bảng `DriverLedger` với cơ chế khoá bi quan `SELECT ... FOR UPDATE`: khi giao COD thành công, cộng `total` vào `codBalance` (nợ sàn), trừ hoa hồng nền tảng (`subtotal × 0.2`) và cộng thu nhập (`driverEarning`). Chặn nhận đơn mới nếu `codBalance >= DRIVER_DEBT_LIMIT (1.000.000đ)`. Admin thu nộp tiền mặt qua `POST /admin/drivers/:userId/settlements`. Màn hình ví tài xế `DriverWalletScreen` và quản lý admin `AdminUsersScreen` hiển thị sổ quỹ chi tiết. |
| C5 | Quy trình giao hàng thất bại nghiêm ngặt | **ĐÃ HOÀN THÀNH** | Tài xế chỉ được báo `DELIVERY_FAILED` khi thoả mãn đồng thời 4 điều kiện: (1) Đã gọi `POST /orders/:id/arrived` trong bán kính ≤ 100m, (2) Đã thực hiện ≥ 3 cuộc gọi liên hệ khách qua `POST /orders/:id/contact-attempts` cách nhau tối thiểu 30s, (3) Đã chờ tối thiểu 10 phút kể từ lúc đến nơi, (4) Chọn mã lý do hợp lệ (`CUSTOMER_UNREACHABLE`, `CUSTOMER_REFUSED`, `WRONG_ADDRESS`). Khi thất bại: hoàn lại tiền hàng cho quán, trừ thu nhập tài xế, tăng `failedDeliveryCount` của khách. |

### 1.4. Trụ Cột D: Bán Kính Hoạt Động, GPS Tài Xế & Socket Bền Vững
| Mục | Nội dung yêu cầu | Trạng thái | Chi tiết triển khai |
|---|---|---|---|
| D1 | Điều phối theo bán kính thực | **ĐÃ HOÀN THÀNH** | `orders.service.ts › findAvailableForDrivers` lọc đơn theo hộp bao (bounding box) + khoảng cách Haversine ≤ `DRIVER_SEARCH_RADIUS_KM (5km)`. Chỉ tài xế trực tuyến có vị trí cập nhật trong vòng 5 phút (`DRIVER_LOCATION_STALE_MINUTES`) mới thấy đơn. Danh sách sắp xếp theo cự ly gần nhất tới quán. Trả về đầy đủ: khoảng cách tới quán, khoảng cách giao, thu nhập, tiền COD cần thu và công nợ sau khi nhận. |
| D2 | Báo cáo GPS tài xế & Tự động ngắt | **ĐÃ HOÀN THÀNH** | Hook `useDriverLocationReporter` chạy ngầm khi tài xế bật trực tuyến, phát sự kiện socket `driver:location` mỗi 10 giây. Gateway giới hạn tần suất 1 sự kiện / 2 giây, lưu toạ độ vào `DriverProfile` mỗi 60 giây. Cron job tự động tắt trực tuyến (`isOnline = false`) các tài xế mất tín hiệu quá 15 phút và gửi push cảnh báo. |
| D3 | Socket bền vững & Làm mới Token | **ĐÃ HOÀN THÀNH** | Hook `useSocket` cấu hình dynamic auth callback; khi gặp sự kiện `connect_error` tự động kích hoạt `refreshAuthTokens()` để lấy access token mới và kết nối lại Socket.IO mà không cần đăng nhập lại. Tự động rejoin lại room đơn hàng khi mạng khôi phục. Socket `order:available` phát đủ payload chi tiết đơn, cự ly và thu nhập. |

### 1.5. Trụ Cột E: Cron Jobs, Gỡ Bỏ Dữ Liệu Giả, Đánh Giá & Điều Hành Admin
| Mục | Nội dung yêu cầu | Trạng thái | Chi tiết triển khai |
|---|---|---|---|
| E1 | Hệ thống tác vụ định kỳ (Cron Jobs) | **ĐÃ HOÀN THÀNH** | Cài đặt `@nestjs/schedule` (v5 tương thích NestJS 11). `OrderJobsService` chạy định kỳ với cờ in-process và khoá `pg_try_advisory_lock`: (1) Huỷ đơn `PENDING` quá 5 phút chưa được quán nhận (`SYSTEM_TIMEOUT`), (2) Phát hiện đơn ứ đọng chuẩn bị > 30 phút hoặc chờ tài xế > 15 phút, đánh dấu `stalledAt`, phát sự kiện `order:stalled` cho Admin và phát lại `order:available` mở rộng bán kính × 2 (10km), (3) Tự động ngắt trực tuyến tài xế mất GPS > 15 phút. |
| E2 | Gỡ bỏ 100% tính năng & dữ liệu giả | **ĐÃ HOÀN THÀNH** | Xoá vĩnh viễn `DriverCallScreen.tsx`, `ChatScreen.tsx`, `VoucherSelectScreen.tsx` và mọi route liên quan. Mọi nút gọi sử dụng `Linking.openURL('tel:...')`. Thêm số điện thoại quán `Restaurant.phone` để khách và tài xế gọi trực tiếp. Ẩn số điện thoại khách và tài xế sau khi đơn kết thúc quá 2 giờ. Bỏ ô nhập voucher giả ở Checkout. Bỏ 100% emoji khỏi các chuỗi nghiệp vụ và tiêu đề push notification. |
| E3 | Hệ thống đánh giá đơn hàng & Phản hồi | **ĐÃ HOÀN THÀNH** | `POST /orders/:id/review` cho phép đánh giá đơn hàng hoàn tất (`DELIVERED`) trong vòng 30 ngày. Ràng buộc duy nhất `Review.orderId @unique` chống đánh giá trùng. Cho phép đánh giá đồng thời Quán ăn và Tài xế (`driverRating`, `driverComment`). Điểm quán được tự động aggregate và cập nhật `rating` cùng `ratingCount` trong cùng transaction. API công khai `GET /restaurants/:id/reviews` trả về đánh giá che tên khách ("Nguyễn V. A."). Chủ quán xem đánh giá tại `OwnerReviewsScreen` và được gửi phản hồi 1 lần duy nhất (`POST /reviews/:id/reply`). |
| E4 | Bộ công cụ điều hành đơn hàng cho Admin | **ĐÃ HOÀN THÀNH** | Xây dựng màn hình `AdminOrdersScreen` tích hợp vào `AdminTabNavigator`: lọc đơn theo trạng thái, lọc đơn "Ứ đọng", tìm kiếm theo mã đơn / SĐT / tên khách / tên quán. BottomSheet chi tiết đơn cho phép xem toàn bộ lịch sử trạng thái, vị trí tài xế cuối, số lần liên hệ khách. Admin có quyền "Huỷ đơn" (bắt buộc nhập lý do) và "Gỡ tài xế" (`POST /admin/orders/:id/unassign-driver`) để điều phối lại. `AdminDashboardScreen` hiển thị số đơn ứ đọng, số quán chờ duyệt, tổng công nợ COD và lắng nghe socket `order:stalled` realtime. |

---

### 1.6. Kết Quả Xử Lý Bảng 3.8 (Các Lỗi Nhỏ Khác)

| # | Mô tả lỗi | File liên quan | Cách xử lý trong V4 | Trạng thái |
|---|---|---|---|---|
| 1 | Socket `order:available` gửi object rút gọn, màn tài xế thiếu thông tin | `orders.gateway.ts`, `DriverAvailableOrdersScreen.tsx` | Đã gửi payload đầy đủ gồm cự ly, thu nhập, tiền thu COD và công nợ sau nhận. | **ĐÃ SỬA** |
| 2 | Thống kê tài xế tính theo ngày tạo đơn thay vì ngày giao | `orders.service.ts › getDriverStats`, `driver-stats.ts` | Đã sửa truy vấn lấy theo `statusHistory` ngày chuyển trạng thái `DELIVERED`. | **ĐÃ SỬA** |
| 3 | Thu nhập tài xế tính bằng 100% phí ship | `driver-stats.ts` | Đã tính thu nhập chuẩn bằng `driverEarning` (80% phí ship sau khi trừ 20% hoa hồng nền tảng). | **ĐÃ SỬA** |
| 4 | Mobile làm tròn khoảng cách 0.1km trước khi tính phí | `mobile/src/utils/fee.ts` | Đã gỡ bỏ toàn bộ logic tính phí ship ở client. Phí do backend tính chính xác. | **ĐÃ SỬA** |
| 5 | Checkout không cho đổi địa chỉ, trang chủ dùng GPS còn checkout dùng địa chỉ lưu | `CheckoutScreen.tsx`, `HomeScreen.tsx` | Đã chuyển sang nguồn địa chỉ duy nhất `resolveActiveDeliveryAddress`. | **ĐÃ SỬA** |
| 6 | Deep link VNPay mở màn Checkout với orderId 8 ký tự | `mobile/App.tsx`, `payments.service.ts` | Đã xoá bỏ deep link và màn hình thanh toán VNPay. | **ĐÃ SỬA** |
| 7 | IPN thành công sau khi đơn bị huỷ vẫn đánh dấu `PAID` | `payments.service.ts › handleIpn` | Đã bổ sung logic kiểm tra: nếu đơn `CANCELLED` thì chuyển sang `REFUNDED` và ghi audit log. | **ĐÃ SỬA** |
| 8 | Socket/push phát trong transaction của IPN | `payments.service.ts` | Đã chuyển việc phát socket và push notification ra ngoài transaction sau khi commit. | **ĐÃ SỬA** |
| 9 | Chủ quán xoá quán đã có đơn gây lỗi khoá ngoại DB | `restaurants.service.ts › delete` | Chặn xoá cứng quán đã có đơn hàng; yêu cầu chuyển trạng thái đóng cửa hoặc liên hệ admin. | **ĐÃ SỬA** |
| 10 | `Restaurant.rating` không có số lượt đánh giá | `schema.prisma`, `restaurants.service.ts` | Đã thêm cột `ratingCount Int @default(0)` vào model `Restaurant`. | **ĐÃ SỬA** |
| 11 | Tài xế bật trực tuyến không gửi vị trí, tắt app vẫn "trực tuyến" mãi | `drivers.service.ts`, `order-jobs.service.ts` | Bắt buộc gửi toạ độ khi bật online; Cron job tự động chuyển offline nếu mất GPS > 15 phút. | **ĐÃ SỬA** |
| 12 | Cache và giới hạn tốc độ Maps phình không giới hạn bộ nhớ | `maps/utils/rate-limiter.util.ts`, `maps.controller.ts` | Đã áp dụng `LruCache` có dung lượng tối đa 10.000 khoá và TTL tự dọn dẹp. | **ĐÃ SỬA** |
| 13 | `MAX_ACTIVE_DELIVERIES` viết cứng (hardcoded) | `orders.service.ts` | Đã chuyển thành cấu hình trong `configuration.ts` (`maxActiveDeliveriesPerDriver: 1`). | **ĐÃ SỬA** |
| 14 | Push notification có emoji | `notifications.service.ts` | Đã loại bỏ toàn bộ emoji khỏi các chuỗi thông báo push. | **ĐÃ SỬA** |
| 15 | `useLocation` trả toạ độ TP.HCM giả khi bị từ chối quyền | `mobile/src/hooks/useLocation.ts` | Trả về `coords: null` kèm cờ báo lỗi; các màn hình xử lý trạng thái rỗng chuẩn mực. | **ĐÃ SỬA** |
| 16 | Chưa có giờ mở cửa chi tiết theo từng ngày trong tuần | `Restaurant` | **Chưa thực hiện ở V4** (theo chỉ đạo kiến trúc, dành cho phiên bản V5). | **CHUYỂN V5** |

---

## 2. Danh Sách Migration, Bảng / Cột Mới & Lệnh Sao Lưu

### 2.1. Lệnh Sao Lưu Cơ Sở Dữ Liệu Đã Chạy (Sprint 0)
- **Lệnh thực hiện:** `pg_dump -h localhost -p 5433 -U postgres -F c -b -v -f backup_truoc_v4.dump food_delivery`
- **Kích thước file sao lưu:** `873.814 bytes`
- **Thời gian hoàn tất:** 30/10/2026. File sao lưu được lưu trữ an toàn tại thư mục gốc dự án.

### 2.2. Migration Đã Áp Dụng
- **Tên migration:** `20261031000000_v4_business_upgrade`
- **Trạng thái:** Applied successfully (`Database schema is up to date` - 7 migrations active).
- **Nguyên tắc tuân thủ:** Không chạy `migrate reset` hay `--force-reset`, không làm mất dữ liệu hiện hữu.

### 2.3. Các Bảng & Cột Mới Trong Cơ Sở Dữ Liệu
1. **Enum Mới:**
   - `RestaurantStatus`: `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`
   - `CancelReason`: `CUSTOMER_CHANGE_MIND`, `ORDER_WRONG_ITEMS`, `WAITING_TOO_LONG`, `FOUND_BETTER_OPTION`, `RESTAURANT_OUT_OF_STOCK`, `RESTAURANT_OVERLOADED`, `RESTAURANT_CLOSED`, `NO_DRIVER_AVAILABLE`, `SYSTEM_TIMEOUT`, `ADMIN_INTERVENTION`
   - `DeliveryFailedReason`: `CUSTOMER_UNREACHABLE`, `CUSTOMER_REFUSED`, `WRONG_ADDRESS`, `FORCE_MAJEURE`
   - `DriverLedgerType`: `COD_COLLECTED`, `COMMISSION_FEE`, `DRIVER_EARNING`, `CASH_DEPOSIT`, `ADJUSTMENT`, `FAILED_DELIVERY_REFUND`
2. **Cột Mới Trong Bảng `restaurants`:**
   - `status`: `RestaurantStatus` (mặc định `PENDING_APPROVAL`, dữ liệu cũ chuyển thành `ACTIVE`).
   - `approvedAt`: `DateTime?`
   - `approvedById`: `String?`
   - `suspendReason`: `String?`
   - `phone`: `String?`
   - `ratingCount`: `Int @default(0)`
3. **Cột Mới Trong Bảng `orders`:**
   - `cancelReason`: `CancelReason?`
   - `failedReason`: `DeliveryFailedReason?`
   - `cancelNote`: `String?`
   - `quoteSignature`: `String?`
   - `quoteExpiresAt`: `DateTime?`
   - `stalledAt`: `DateTime?`
   - `driverArrivedAt`: `DateTime?`
   - `failedAt`: `DateTime?`
   - `idempotencyKey`: `String?`
   - `idempotencyExpiresAt`: `DateTime?`
4. **Cột Mới Trong Bảng `driver_profiles`:**
   - `codBalance`: `Int @default(0)`
   - `lastLatitude`: `Float?`
   - `lastLongitude`: `Float?`
   - `lastLocationAt`: `DateTime?`
5. **Cột Mới Trong Bảng `users`:**
   - `failedDeliveryCount`: `Int @default(0)`
6. **Cột Mới Trong Bảng `order_status_history`:**
   - `note`: `String?`
7. **Cột Mới Trong Bảng `reviews`:**
   - `orderId`: `String? @unique`
   - `driverId`: `String?`
   - `driverRating`: `Int?`
   - `driverComment`: `String?`
   - `ownerReply`: `String?`
   - `ownerRepliedAt`: `DateTime?`
   - `isHidden`: `Boolean @default(false)`
   - `hideReason`: `String?`
8. **Bảng Mới:**
   - `driver_ledgers`: Lưu lịch sử biến động sổ quỹ tiền mặt COD và thu nhập của tài xế (`id`, `driverId`, `orderId?`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `description?`, `recordedById?`, `createdAt`).
   - `order_contact_attempts`: Lưu nhật ký các lần tài xế gọi điện cho khách hàng (`id`, `orderId`, `driverId`, `attemptNumber`, `calledAt`, `callDurationSeconds?`, `note?`).

---

## 3. Danh Sách Endpoint Mới & Cập Nhật

| Phương thức | Đường dẫn | Quyền hạn | Mô tả chức năng |
|---|---|---|---|
| `GET` | `/config/public` | Public | Lấy hằng số cấu hình kinh doanh (phí ship, khung giờ cao điểm, hạn mức COD). |
| `POST` | `/orders/quote` | CUSTOMER | Tính toán báo giá đơn hàng chính thức kèm chữ ký HMAC-SHA256 (`quoteToken`). |
| `POST` | `/orders` | CUSTOMER | Tạo đơn hàng bằng `quoteToken` và header `Idempotency-Key` (chỉ COD). |
| `PATCH` | `/orders/:id/status` | Tác nhân liên quan / ADMIN | Chuyển trạng thái đơn hàng theo máy trạng thái V4 kèm mã lý do. |
| `POST` | `/orders/:id/release` | DRIVER | Tài xế trả đơn chưa lấy để hệ thống điều phối lại (tối đa 3 lần/ngày). |
| `POST` | `/orders/:id/arrived` | DRIVER | Tài xế xác nhận đã đến điểm giao hàng (khoảng cách GPS ≤ 100m). |
| `POST` | `/orders/:id/contact-attempts` | DRIVER | Ghi nhận một lần gọi điện liên hệ khách hàng (tối thiểu 30s giữa 2 lần bấm). |
| `POST` | `/orders/:id/review` | CUSTOMER | Đánh giá đơn hàng (quán ăn & tài xế) sau khi giao thành công (trong vòng 30 ngày). |
| `GET` | `/restaurants/:id/reviews` | Public | Danh sách đánh giá công khai của quán (ẩn họ tên, hiện phản hồi quán). |
| `GET` | `/restaurants/:id/reviews/manage` | OWNER/ADMIN | Quản lý đánh giá của quán, kèm mã đơn và bộ lọc chưa phản hồi. |
| `POST` | `/reviews/:id/reply` | OWNER/ADMIN | Phản hồi đánh giá của thực khách (chỉ gửi 1 lần duy nhất). |
| `GET` | `/drivers/me/ledger` | DRIVER | Xem lịch sử biến động sổ quỹ COD và công nợ của tài xế. |
| `GET` | `/admin/drivers/ledger` | ADMIN | Báo cáo công nợ toàn sàn của tất cả tài xế. |
| `POST` | `/admin/drivers/:userId/settlements`| ADMIN | Ghi nhận tài xế nộp tiền mặt COD để giải toả hạn mức công nợ. |
| `POST` | `/admin/drivers/:userId/adjustments`| ADMIN | Điều chỉnh sai lệch sổ quỹ tài xế. |
| `GET` | `/admin/orders` | ADMIN | Danh sách đơn hàng toàn sàn, lọc đơn ứ đọng, tìm kiếm theo mã đơn / SĐT. |
| `GET` | `/admin/orders/:id` | ADMIN | Chi tiết đơn hàng cho điều hành (lịch sử trạng thái, vị trí GPS tài xế cuối). |
| `POST` | `/admin/orders/:id/unassign-driver` | ADMIN | Gỡ tài xế khỏi đơn hàng và phát lại đơn cho tài xế khác. |
| `PATCH` | `/admin/reviews/:id/visibility` | ADMIN | Ẩn/hiện đánh giá vi phạm và tự động tính lại điểm trung bình quán. |
| `PATCH` | `/admin/restaurants/:id/approve` | ADMIN | Phê duyệt hồ sơ quán ăn chuyển sang `ACTIVE`. |
| `PATCH` | `/admin/restaurants/:id/reject` | ADMIN | Từ chối hồ sơ quán ăn kèm lý do. |
| `PATCH` | `/admin/restaurants/:id/status` | ADMIN | Tạm ngưng (`SUSPENDED`) hoặc mở lại quán ăn. |
| `POST` | `/payments/vnpay/:orderId/url` | CUSTOMER | **TẠM NGƯNG** — Luôn trả về HTTP 400 yêu cầu chọn hình thức COD. |

---

## 4. Biến `.env` Mới & Giá Trị Mặc Định

Các biến cấu hình mới được thêm vào `backend/.env.example`, `backend/.env` và nạp qua `configuration.ts` (`business` namespace) kèm bộ kiểm tra tính hợp lệ (`validateEnv`):

```env
# Phí giao hàng & Bán kính
DELIVERY_BASE_FEE=15000                   # Phí ship cơ bản (VND)
DELIVERY_FEE_PER_KM=5000                  # Phí mỗi km tiếp theo (VND)
DELIVERY_FREE_KM=2                        # Số km đầu tiên tính trong phí cơ bản
DELIVERY_PEAK_MULTIPLIER=1.2              # Hệ số nhân phí ship giờ cao điểm
DELIVERY_PEAK_WINDOWS=11:00-13:00,17:30-19:30 # Khung giờ cao điểm (giờ VN)
ROAD_DISTANCE_FALLBACK_FACTOR=1.3         # Hệ số Haversine khi Goong Map lỗi/không khả dụng
QUOTE_TTL_MINUTES=10                      # Thời gian hiệu lực của báo giá (phút)

# Hoa hồng & Công nợ COD
PLATFORM_COMMISSION_RATE=0.2              # Hoa hồng nền tảng (20% trên phí ship)
DRIVER_DEBT_LIMIT=1000000                 # Hạn mức nợ tiền mặt COD tối đa của tài xế (VND)

# Điều phối tài xế & Vị trí
DRIVER_SEARCH_RADIUS_KM=5                 # Bán kính tìm tài xế khả dụng quanh quán (km)
DRIVER_LOCATION_STALE_MINUTES=5           # Quá số phút này toạ độ tài xế bị coi là cũ
DRIVER_OFFLINE_AFTER_MINUTES=15           # Mất tín hiệu quá số phút này sẽ tự động chuyển Offline
MAX_ACTIVE_DELIVERIES_PER_DRIVER=1        # Số đơn giao cùng lúc tối đa của mỗi tài xế
MAX_ORDER_RELEASE_PER_DAY=3               # Số lần tối đa tài xế được trả đơn trong ngày
ARRIVAL_MAX_DISTANCE_M=100                # Khoảng cách tối đa (mét) cho phép bấm "Đã đến nơi"
MIN_WAIT_MINUTES_BEFORE_FAIL=10           # Thời gian chờ tối thiểu (phút) trước khi báo giao thất bại
MIN_CALL_ATTEMPTS_BEFORE_FAIL=3           # Số cuộc gọi tối thiểu cho khách trước khi báo giao thất bại
MIN_CALL_INTERVAL_SECONDS=30              # Khoảng cách thời gian tối thiểu giữa 2 lần bấm gọi (giây)

# Kiểm duyệt & Đánh giá
ORDER_PENDING_TIMEOUT_MINUTES=5           # Quá số phút này quán không nhận thì đơn tự huỷ
ORDER_STALLED_PREPARING_MINUTES=30        # Quán chuẩn bị quá thời gian này bị coi là ứ đọng
ORDER_STALLED_PICKUP_MINUTES=15           # Quán báo xong quá thời gian này chưa có tài xế nhận bị coi là ứ đọng
REVIEW_WINDOW_DAYS=30                     # Thời hạn khách hàng được đánh giá đơn sau khi nhận (ngày)
```

---

## 5. Kết Quả Kiểm Tra Lệnh Nghiệm Thu (6.1) & Kịch Bản Kiểm Thử (6.3)

### 5.1. Kết Quả Các Lệnh Nghiệm Thu Bắt Buộc (Mục 6.1)
| Lệnh kiểm tra | Môi trường | Kết quả thực tế | Ghi chú |
|---|---|---|---|
| `npx prisma validate` | Backend | **PASS** | Schema Prisma hoàn toàn hợp lệ. |
| `npx prisma migrate status` | Backend | **PASS** | `Database schema is up to date` (7 migrations). |
| `npx tsc --noEmit -p tsconfig.build.json` | Backend | **PASS** | Biên dịch TypeScript backend thành công, 0 lỗi. |
| `npm run lint` | Backend | **PASS** | ESLint đạt chuẩn: 0 errors, 43 warnings (các type `any` cho phép trong file test). |
| `npm test` | Backend | **PASS** | **19/19 test suites vượt qua**, 116/116 unit tests xanh. |
| `npx tsc --noEmit` | Mobile | **PASS** | Biên dịch TypeScript React Native thành công, 0 lỗi. |
| `npx jest` | Mobile | **PASS** | **8/8 test suites vượt qua**, 40/40 unit tests xanh. |
| `npx expo export -p web` | Mobile | **PASS** | Bundle web xuất thành công vào thư mục `dist`. |
| `npx expo export -p ios` | Mobile | **PASS** | Bundle iOS xuất thành công (Hermes bytecode 5.2MB). |

### 5.2. Kết Quả Kiểm Thử Các Kịch Bản Nghiệp Vụ (Mục 6.3)
1. **Đăng ký chặn vai trò:** Gọi `POST /auth/register` truyền `role: "RESTAURANT_OWNER"` bị từ chối 400 Validation Error do `RegisterDto` không chấp nhận `role`. -> **ĐẠT**
2. **Kiểm duyệt quán:** Chủ quán tạo quán mới, quán có trạng thái `PENDING_APPROVAL`, danh sách `GET /restaurants/nearby` của khách hàng không hiển thị. Sau khi Admin duyệt `approve`, quán chuyển `ACTIVE` và xuất hiện trên app khách. -> **ĐẠT**
3. **Khoá tài khoản tức thì:** Khi Admin khoá tài khoản khách hàng, `AuthStateService` ghi nhận ngay lập tức; request tiếp theo của khách nhận HTTP 401 và kết nối Socket.IO bị ngắt tự động. -> **ĐẠT**
4. **Nguồn địa chỉ duy nhất & Báo giá chống gian lận:** Khách chọn địa chỉ tại trang chủ, màn Checkout lấy đúng toạ độ đã chọn; khi chủ quán tăng giá món ăn tại quán, khách bấm Đặt hàng nhận mã lỗi HTTP 409 `QUOTE_CHANGED` và được thông báo lấy lại báo giá mới. -> **ĐẠT**
5. **Huỷ đơn quá hạn tự động:** Đơn hàng ở trạng thái `PENDING` quá 5 phút không được quán bấm Xác nhận sẽ được Cron job chuyển sang `CANCELLED` với tác nhân `SYSTEM` và lý do `SYSTEM_TIMEOUT`, khách hàng và chủ quán nhận push thông báo. -> **ĐẠT**
6. **Điều phối theo cự ly GPS:** Tài xế trực tuyến trong bán kính 5km quanh quán nhận được sự kiện socket `order:available` với đầy đủ thông tin thu nhập; tài xế ở xa ngoài bán kính không nhận được đơn. -> **ĐẠT**
7. **Bản đồ tài xế di chuyển:** Tài xế nhận đơn và báo cáo toạ độ qua socket `driver:location`, màn hình theo dõi đơn `OrderTrackingScreen` của khách hàng nhận realtime toạ độ và di chuyển vị trí marker tài xế. -> **ĐẠT**
8. **Công nợ COD & Sổ quỹ:** Giao đơn COD thành công, tiền mặt `total` được ghi nợ vào `codBalance` của tài xế và trích thu nhập `driverEarning` vào sổ quỹ `DriverLedger`. Khi `codBalance >= 1.000.000đ`, tài xế bị khoá quyền nhận đơn mới cho đến khi Admin thực hiện nộp tiền `POST /admin/drivers/:userId/settlements`. -> **ĐẠT**
9. **Giao thất bại chuẩn xác:** Tài xế bấm báo giao thất bại khi chưa đủ 10 phút hoặc chưa gọi đủ 3 cuộc gọi cách nhau 30s đều bị chặn với mã lỗi HTTP 409. Khi thoả mãn toàn bộ điều kiện, đơn chuyển `DELIVERY_FAILED`, tiền hàng được hoàn trả lại cho quán và khách hàng bị tăng chỉ số `failedDeliveryCount`. -> **ĐẠT**
10. **Đánh giá đơn hàng & Phản hồi:** Khách hàng đánh giá đơn sau khi nhận món thành công; đánh giá lần hai trên cùng đơn bị chặn HTTP 409 (`P2002 @unique`). Chủ quán xem danh sách đánh giá tại `OwnerReviewsScreen` và gửi phản hồi thành công; phản hồi lần hai bị chặn HTTP 409. -> **ĐẠT**
11. **Rà soát dữ liệu giả & Emoji:** Chạy các lệnh kiểm tra mẫu dữ liệu cứng cấm ở mục 1.5 trả về 0 kết quả. Toàn bộ emoji trong mã nguồn nghiệp vụ backend và mobile đã được loại bỏ sạch sẽ. -> **ĐẠT**

---

## 6. Các Quyết Định Kỹ Thuật Đã Lựa Chọn Khi Gặp Điểm Mơ Hồ

1. **Khắc phục xung đột ESM của `@nestjs/schedule`:** Khi cài đặt `@nestjs/schedule`, npm tự động cài bản 12 (thuần ESM) gây lỗi `SyntaxError: Unexpected token 'export'` khi chạy Jest trong môi trường CommonJS của NestJS 11. Đã chuẩn hoá cài đặt phiên bản `@nestjs/schedule@^5.0.0` tương thích hoàn hảo với NestJS 11 và cấu hình Jest hiện tại.
2. **Quyền riêng tư số điện thoại:** Nhằm bảo vệ thông tin cá nhân của khách hàng và tài xế, sau khi đơn hàng kết thúc (`DELIVERED`, `CANCELLED`, `DELIVERY_FAILED`) quá 2 giờ, trường `phone` của khách hàng và tài xế trong `OrderDetail` được tự động làm mờ thành `null`. Trong thời gian đơn đang giao, các bên liên hệ trực tiếp qua số thật.
3. **Tính toán khoảng cách đường bộ fallback:** Khi chưa cấu hình khoá Goong API (`GOONG_API_KEY`) hoặc gặp sự cố mạng, hệ thống không làm gián đoạn việc đặt hàng mà sử dụng công thức Haversine nhân với hệ số thực tế `ROAD_DISTANCE_FALLBACK_FACTOR = 1.3`, gắn nhãn `ESTIMATED` và áp dụng thời gian lưu cache ngắn (5 phút) để thử lại Goong khi có thể.
4. **Cơ chế khoá phân tán đơn giản cho Cron Jobs:** Nhằm phòng ngừa nguy cơ chạy đúp tác vụ định kỳ khi mở rộng nhiều tiến trình Node.js mà chưa cần tới hạ tầng Redis, hệ thống kết hợp cờ trạng thái in-process cùng khoá cố vấn cơ sở dữ liệu `pg_try_advisory_lock` của PostgreSQL (`LOCK_PENDING_TIMEOUT`, `LOCK_STALLED_PICKUP`, `LOCK_STALE_DRIVERS`).

---

## 7. Giới Hạn Còn Lại & Kế Hoạch Cho Phiên Bản Tiếp Theo (V5)

Hệ thống ZomZom V4 đã hoàn thành 100% mục tiêu đưa nghiệp vụ về chuẩn thực tế, xử lý trọn vẹn mô hình thanh toán COD, công nợ tài xế, kiểm duyệt nội dung và loại bỏ triệt để các màn hình/dữ liệu giả lập. Các hạng mục sau được định vị rõ ràng cho phiên bản **V5**:

1. **Chat trực tiếp theo từng đơn hàng:** Bổ sung model `OrderMessage` trong cơ sở dữ liệu, lưu trữ lịch sử tin nhắn giữa Khách hàng - Tài xế - Quán ăn và truyền phát thời gian thực qua kênh socket chuyên biệt.
2. **Tổng đài cuộc gọi ẩn số (Number Masking VoIP):** Tích hợp dịch vụ tổng đài ảo (Twilio / Stringee) để kết nối cuộc gọi ẩn danh hai chiều, bảo mật tuyệt đối số điện thoại cá nhân.
3. **Theo dõi vị trí tài xế khi ứng dụng chạy nền (Background Geolocation):** Tích hợp thư viện chạy ngầm native (`react-native-background-geolocation` hoặc Expo TaskManager) để tài xế vẫn cập nhật toạ độ GPS khi khoá màn hình hoặc chuyển sang ứng dụng bản đồ dẫn đường.
4. **Hệ thống Voucher & Khuyến mãi máy chủ:** Kích hoạt bảng `vouchers` với đầy đủ logic điều kiện áp dụng, hạn mức sử dụng và ngân sách khuyến mãi do Quán ăn hoặc Sàn tài trợ.
5. **Cấu hình giờ mở cửa chi tiết theo từng ngày trong tuần:** Cho phép quán ăn thiết lập khung giờ mở cửa khác nhau cho từng ngày (thứ Hai đến Chủ nhật) và ngày lễ.
6. **Mở lại cổng thanh toán trực tuyến (Online Payment):** Tích hợp lại VNPay, MoMo, ZaloPay với quy trình hoàn tiền tự động (Automated Refund) và đối soát giao dịch an toàn.
7. **Hạ tầng đa tiến trình (Multi-Instance Scaling):** Triển khai Redis Adapter cho Socket.IO (`@socket.io/redis-adapter`) và Redis Cache dùng chung khi vận hành hệ thống trên cụm máy chủ hoặc Kubernetes.
