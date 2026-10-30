# API Contract — ZomZom Food Delivery Backend (V4 Business Upgrade)

Base URL: `http://<host>:3000/api/v1`

---

## 1. Response Envelope & Authentication

### Success Response
```json
{
  "success": true,
  "data": <payload>
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Thông báo lỗi tiếng Việt thân thiện",
  "errors": ["Chi tiết lỗi nếu có"],
  "path": "/api/v1/orders",
  "timestamp": "2026-10-31T03:00:00.000Z"
}
```

### Authentication & Authorization
- **Header:** `Authorization: Bearer <accessToken>` (áp dụng cho mọi endpoint trừ endpoint có đánh dấu **Public**).
- **Token Invalidation:** Token bị thu hồi tức thì (trả về `401 Unauthorized`) khi:
  - Tài khoản bị quản trị viên khoá (`isActive = false`).
  - Vai trò của tài khoản bị thay đổi (`role !== token.role`).
- **Token Refresh:** Access token hết hạn trả về `401`. Client gọi `POST /auth/refresh` với refresh token (cơ chế Rotation: mỗi token dùng một lần).

---

## 2. Enums & Common Data Types

- **Role:** `CUSTOMER | RESTAURANT_OWNER | DRIVER | ADMIN`
- **RestaurantStatus:** `PENDING_APPROVAL | ACTIVE | SUSPENDED`
- **OrderStatus:** `PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP → PICKED_UP → DELIVERED` (hoặc `CANCELLED`, `DELIVERY_FAILED`)
- **PaymentMethod:** `COD` *(VNPAY tạm ngừng ở phiên bản V4)*
- **PaymentStatus:** `UNPAID | PAID | FAILED | REFUNDED`
- **DriverVerificationStatus:** `UNVERIFIED | PENDING | VERIFIED | REJECTED`
- **DriverLedgerType:** `COD_COLLECTED | COMMISSION_FEE | DRIVER_EARNING | CASH_DEPOSIT | ADJUSTMENT | FAILED_DELIVERY_REFUND`

---

## 3. Public Configuration

### `GET /config/public` (Public)
Trả về các hằng số cấu hình nghiệp vụ để mobile client hiển thị thông tin chính xác mà không tự tính toán:
```json
{
  "deliveryBaseFee": 15000,
  "deliveryFeePerKm": 5000,
  "deliveryFreeKm": 2,
  "deliveryPeakMultiplier": 1.2,
  "deliveryPeakWindows": "11:00-13:00,17:30-19:30",
  "driverDebtLimit": 1000000,
  "quoteTtlMinutes": 10,
  "arrivalMaxDistanceM": 100,
  "reviewWindowDays": 30,
  "maxOrderReleasePerDay": 3,
  "codOnly": true
}
```

---

## 4. Auth (`/auth`)

| Method | Path | Quyền | Body | Mô tả |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ email, password, fullName, phone? }` | Đăng ký tài khoản (mặc định luôn gán vai trò `CUSTOMER`, không nhận `role` từ client) |
| POST | `/auth/login` | Public | `{ email, password }` | Đăng nhập hệ thống |
| POST | `/auth/refresh` | Public | `{ refreshToken }` | Làm mới cặp token |
| POST | `/auth/logout` | User | – | Thu hồi refresh token hiện tại |

---

## 5. Users & Addresses (`/users`)

| Method | Path | Quyền | Body | Mô tả |
|---|---|---|---|---|
| GET | `/users/me` | User | – | Lấy thông tin tài khoản hiện tại |
| PATCH | `/users/me` | User | `{ fullName?, phone?, avatarUrl? }` | Cập nhật thông tin cá nhân |
| PUT | `/users/me/push-token` | User | `{ expoPushToken }` | Đăng ký push token |
| GET | `/users/me/addresses` | User | – | Danh sách địa chỉ đã lưu |
| POST | `/users/me/addresses` | User | `{ label, addressLine, latitude, longitude, isDefault? }` | Thêm địa chỉ mới |
| DELETE | `/users/me/addresses/:id` | User | – | Xoá địa chỉ |

---

## 6. Maps & Reverse Geocoding (`/maps`)

| Method | Path | Quyền | Params | Mô tả |
|---|---|---|---|---|
| GET | `/maps/info` | Public | – | Thông tin provider bản đồ hiện hành |
| GET | `/maps/reverse-geocode` | User | `lat, lng` | Chuyển toạ độ sang địa chỉ đường (cache LRU + rate limit 30 req/phút) |
| GET | `/maps/autocomplete` | User | `q, lat?, lng?` | Gợi ý địa điểm |
| GET | `/maps/place-detail` | User | `placeId` | Chi tiết toạ độ địa điểm |
| GET | `/maps/distance` | User | `originLat, originLng, destLat, destLng` | Tính khoảng cách đường đi thực tế |

---

## 7. Restaurants (`/restaurants`)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/restaurants/nearby` | Public | Lấy danh sách quán gần toạ độ `lat, lng`. Chỉ trả về quán `status = ACTIVE`. |
| GET | `/restaurants/:id` | Public | Chi tiết quán ăn, thực đơn theo danh mục và số lượt đánh giá `ratingCount`. |
| GET | `/restaurants/mine` | OWNER/ADMIN | Quán ăn do tài khoản hiện tại sở hữu. |
| POST | `/restaurants` | OWNER/ADMIN | Tạo mới quán ăn (chuyển sang `status = PENDING_APPROVAL`). |
| PATCH | `/restaurants/:id` | OWNER/ADMIN | Cập nhật quán ăn. Nếu sửa các thông tin nhạy cảm (tên, địa chỉ, toạ độ), quán tự động chuyển về `PENDING_APPROVAL` chờ duyệt lại. |

---

## 8. Reviews (`/restaurants/:id/reviews` & `/reviews`)

### `GET /restaurants/:id/reviews` (Public)
Lấy danh sách đánh giá công khai của quán (chỉ trả về đánh giá chưa bị ẩn `isHidden = false`).
- **Query:** `page=1&limit=10&rating=`
- **Response:**
```json
{
  "items": [
    {
      "id": "rv_123",
      "rating": 5,
      "comment": "Món ăn rất ngon, nóng hổi",
      "customerName": "Nguyễn V. A.",
      "createdAt": "2026-10-30T10:00:00.000Z",
      "ownerReply": "Cảm ơn bạn đã ủng hộ quán!",
      "ownerRepliedAt": "2026-10-30T11:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 10
}
```

### `GET /restaurants/:id/reviews/manage` (OWNER/ADMIN)
Lấy danh sách đánh giá kèm mã đơn hàng phục vụ quản lý:
- **Query:** `page=1&limit=20&unrepliedOnly=true|false`
- **Response:** Danh sách đánh giá gồm cả `orderId`, `driverRating`, `driverComment`.

### `POST /reviews/:id/reply` (OWNER/ADMIN)
Phản hồi đánh giá của thực khách (chỉ được gửi 1 lần duy nhất):
- **Body:** `{ "reply": "Nội dung phản hồi từ chủ quán (tối đa 500 ký tự)" }`
- **Mã lỗi:** `409 Conflict` nếu đánh giá này đã được phản hồi trước đó.

---

## 9. Orders & Pricing (`/orders`)

### `POST /orders/quote` (CUSTOMER)
Lấy báo giá chính thức từ server (kèm chữ ký bảo mật HMAC-SHA256):
- **Body:**
```json
{
  "restaurantId": "rest_123",
  "items": [
    { "menuItemId": "item_1", "quantity": 2, "note": "Ít cay" }
  ],
  "deliveryAddress": "123 Lê Lợi, P. Bến Nghé, Quận 1",
  "deliveryLat": 10.7769,
  "deliveryLng": 106.7009
}
```
- **Response:**
```json
{
  "quoteToken": "eyJhbGciOi...",
  "subtotal": 90000,
  "deliveryFee": 20000,
  "total": 110000,
  "distanceKm": 2.5,
  "distanceType": "ROAD",
  "isPeak": false,
  "expiresAt": "2026-10-31T03:10:00.000Z"
}
```

### `POST /orders` (CUSTOMER)
Tạo đơn hàng chính thức từ báo giá (chỉ chấp nhận COD):
- **Headers:** `Idempotency-Key: <uuid>` (chống trùng lặp đơn trong vòng 10 phút).
- **Body:**
```json
{
  "quoteToken": "eyJhbGciOi...",
  "restaurantId": "rest_123",
  "items": [{ "menuItemId": "item_1", "quantity": 2, "note": "Ít cay" }],
  "deliveryAddress": "123 Lê Lợi, P. Bến Nghé, Quận 1",
  "deliveryLat": 10.7769,
  "deliveryLng": 106.7009,
  "note": "Giao cổng sau",
  "paymentMethod": "COD"
}
```
- **Mã lỗi:**
  - `400 Bad Request`: `quoteToken` không hợp lệ hoặc giỏ hàng gửi kèm không khớp chữ ký báo giá.
  - `409 Conflict` (`QUOTE_CHANGED`): Báo giá đã hết hạn hoặc giá món ăn ở quán đã thay đổi, yêu cầu client lấy lại báo giá mới.
  - `403 Forbidden`: Khách hàng có trên 3 đơn giao thất bại trong 30 ngày gần nhất.

### `PATCH /orders/:id/status` (User liên quan / Admin)
Chuyển trạng thái đơn hàng theo máy trạng thái V4:
- **Body:**
```json
{
  "status": "CANCELLED",
  "cancelReason": "CUSTOMER_CHANGE_MIND",
  "cancelNote": "Khách đổi ý muốn đặt món khác"
}
```
- **Luồng huỷ đơn:**
  - Khách hàng: chỉ huỷ khi đơn ở `PENDING` kèm lý do `CUSTOMER_CHANGE_MIND`, `ORDER_WRONG_ITEMS`, `WAITING_TOO_LONG`, `FOUND_BETTER_OPTION`.
  - Quán: huỷ khi `PENDING` hoặc `CONFIRMED` kèm lý do `RESTAURANT_OUT_OF_STOCK`, `RESTAURANT_OVERLOADED`, `RESTAURANT_CLOSED`.
  - Admin: can thiệp mọi lúc kèm lý do `ADMIN_INTERVENTION` và bắt buộc có `cancelNote`.

### `POST /orders/:id/release` (DRIVER)
Tài xế trả lại đơn chưa lấy hàng để hệ thống điều phối lại cho tài xế khác (tối đa 3 lần/ngày):
- **Body:** `{ "reason": "Lý do trả đơn (xe hỏng, quá xa...)" }`

### `POST /orders/:id/arrived` (DRIVER)
Tài xế xác nhận đã đến điểm giao hàng (khoảng cách GPS ≤ 100m so với toạ độ giao):
- **Body:** `{ "latitude": 10.7768, "longitude": 106.7008 }`

### `POST /orders/:id/contact-attempts` (DRIVER)
Ghi nhận một cuộc gọi liên hệ khách hàng (tối thiểu 30 giây giữa 2 lần bấm):
- **Body:** `{ "callDurationSeconds": 15, "note": "Khách không nghe máy" }`

### `POST /orders/:id/review` (CUSTOMER)
Đánh giá chất lượng đơn hàng sau khi hoàn tất (trạng thái `DELIVERED`, trong vòng 30 ngày):
- **Body:**
```json
{
  "rating": 5,
  "comment": "Món ăn ngon và đóng gói cẩn thận",
  "driverRating": 5,
  "driverComment": "Tài xế giao nhanh, lịch sự"
}
```
- **Mã lỗi:** `409 Conflict` nếu đơn hàng đã được đánh giá trước đó (`Review.orderId @unique`).

---

## 10. Drivers (`/drivers`)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| PATCH | `/drivers/status` | DRIVER | Bật/tắt trực tuyến. Bắt buộc gửi `latitude` và `longitude` khi `isOnline = true`. |
| GET | `/drivers/me` | DRIVER | Thông tin hồ sơ, thông tin xe, `codBalance`, `debtLimit`, `canReceiveOrders`, `ratingAvg`, `ratingCount`. |
| GET | `/drivers/me/ledger` | DRIVER | Sổ quỹ COD và lịch sử biến động công nợ (phân trang). |
| GET | `/orders/available` | DRIVER | Danh sách đơn sẵn sàng nhận trong bán kính 5km (bắt buộc toạ độ tài xế không quá 5 phút). Trả về chi tiết `driverEarning`, `codToCollect`, `debtAfterAccept`. |
| POST | `/orders/:id/accept` | DRIVER | Nhận đơn hàng. Kiểm tra hạn mức nợ COD trước khi cho phép nhận. |

---

## 11. Admin Operations (`/admin`)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/admin/stats` | ADMIN | Số liệu tổng quan: GMV, phân bổ trạng thái đơn, `orders.stalled`, `restaurants.pendingApproval`, `drivers.totalCodDebt`. |
| GET | `/admin/orders` | ADMIN | Quản lý danh sách đơn hàng toàn sàn, lọc `status`, `stalled=true`, tìm kiếm theo mã đơn / SĐT. |
| GET | `/admin/orders/:id` | ADMIN | Chi tiết đơn: lịch sử chuyển trạng thái, vị trí tài xế cuối, số lần liên hệ khách. |
| POST | `/admin/orders/:id/unassign-driver` | ADMIN | Gỡ tài xế khỏi đơn hàng và phát lại đơn cho các tài xế khác. |
| PATCH | `/admin/reviews/:id/visibility` | ADMIN | `{ isHidden: boolean, reason: string }` — Ẩn/hiện đánh giá vi phạm và tính lại điểm quán. |
| GET | `/admin/drivers/ledger` | ADMIN | Báo cáo công nợ toàn bộ tài xế. |
| POST | `/admin/drivers/:userId/settlements` | ADMIN | `{ amount, note }` — Thu nộp tiền mặt COD của tài xế. |
| POST | `/admin/drivers/:userId/adjustments` | ADMIN | `{ amount, reason }` — Điều chỉnh công nợ sai sót. |
| PATCH | `/admin/restaurants/:id/approve` | ADMIN | Phê duyệt hồ sơ quán ăn chuyển sang `ACTIVE`. |
| PATCH | `/admin/restaurants/:id/reject` | ADMIN | `{ reason }` — Từ chối hồ sơ quán ăn kèm lý do. |
| PATCH | `/admin/restaurants/:id/status` | ADMIN | `{ status: 'ACTIVE' \| 'SUSPENDED', reason? }` — Tạm khoá hoặc mở lại quán. |

---

## 12. Payments & VNPay (Tạm Ngừng)

### `POST /payments/vnpay/:orderId/url` (TẠM NGỪNG)
- Trả về mã lỗi `400 Bad Request`:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Thanh toán trực tuyến tạm ngừng, vui lòng chọn hình thức COD"
}
```

### `GET /payments/vnpay/ipn` (Public Webhook)
Xử lý webhook dự phòng từ VNPay. Nếu đơn đã bị huỷ trước đó (`CANCELLED`), giao dịch được đánh dấu `REFUNDED` và ghi nhận kiểm toán tự động bên ngoài transaction.

---

## 13. Realtime Events (Socket.IO)

- **Kết nối:** `io(BASE_URL, { auth: { token: accessToken }, transports: ['websocket'] })`
- **Tự động gia hạn:** Khi token hết hạn, client tự động gọi refresh token và kết nối lại Socket.IO.
- **Sự kiện từ Client:**
  - `driver:location`: `{ orderId, lat, lng }` (Rate limit: 1 event / 2 giây).
  - `order:join`: `{ orderId }`
  - `order:leave`: `{ orderId }`
- **Sự kiện từ Server:**
  - `order:available`: Phát tới tài xế đủ điều kiện trong bán kính 5km kèm toàn bộ thông tin đơn hàng, quãng đường và thu nhập.
  - `order:taken`: Thông báo đơn đã có tài xế khác nhận `{ id }`.
  - `order:status`: Cập nhật trạng thái đơn hàng `{ id, status, paymentStatus, driverId, updatedAt }`.
  - `order:stalled`: Cảnh báo đơn ứ đọng phát tới Quản trị viên và phát lại mở rộng bán kính tài xế (10km).
  - `driver:location`: Toạ độ di chuyển của tài xế phát tới khách hàng và quán ăn.
