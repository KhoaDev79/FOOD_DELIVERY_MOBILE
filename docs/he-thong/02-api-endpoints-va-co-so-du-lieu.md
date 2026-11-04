# Phụ lục 02: Danh mục API Endpoints, Socket.IO và Cơ sở dữ liệu

> Tài liệu này thuộc bộ Tài liệu Hệ thống **ZomZom** — xem trang chính tại [docs/TAI_LIEU_HE_THONG.md](../TAI_LIEU_HE_THONG.md).
>
> **Cơ sở mã nguồn:**
> - Toàn bộ 25 file controller trong `backend/src/**/*.controller.ts` (tổng cộng **117 REST endpoints**: 115 endpoint có tiền tố `/api/v1` cấu hình tại `backend/src/main.ts#L50` và 2 endpoint HTML công khai `/s/r/:id`, `/s/d/:id` dùng `@Controller({ path: 's', version: VERSION_NEUTRAL })` tại `backend/src/share/share.controller.ts#L11`).
> - Gateway thời gian thực tại `backend/src/realtime/orders.gateway.ts` (namespace `/realtime`).
> - Lược đồ cơ sở dữ liệu tại `backend/prisma/schema.prisma` (**939 dòng**, **34 model**, **21 enum**, **38 chỉ mục `@@index`**, **13 ràng buộc `@@unique`**).
> - Dữ liệu khởi tạo tại `backend/prisma/seed.ts` (**1.136 dòng**).

---

## Mục lục

1. [Danh mục 117 REST API Endpoints theo nhóm](#1-danh-mục-117-rest-api-endpoints-theo-nhóm)
2. [Danh mục sự kiện WebSocket (Socket.IO)](#2-danh-mục-sự-kiện-websocket-socketio)
3. [Đặc tả chi tiết 34 Bảng (Models) trong PostgreSQL](#3-đặc-tả-chi-tiết-34-bảng-models-trong-postgresql)
4. [Danh mục 21 Enum trong Prisma Schema](#4-danh-mục-21-enum-trong-prisma-schema)
5. [Chi tiết dữ liệu Seed và các trường hợp biên](#5-chi-tiết-dữ-liệu-seed-và-các-trường-hợp-biên)

---

## 1. Danh mục 117 REST API Endpoints theo nhóm

### Quy ước cột trong bảng
- **Vai trò được gọi**:
  - `Public`: Đánh dấu `@Public()`, không yêu cầu JWT.
  - `Optional JWT`: Đánh dấu `@Public()` kết hợp `@UseGuards(OptionalJwtAuthGuard)` để cá nhân hóa nếu có token.
  - `JWT (Mọi vai trò)`: Yêu cầu đăng nhập (`JwtAuthGuard` mặc định toàn cục tại `backend/src/app.module.ts#L71`), không giới hạn `@Roles()`.
  - `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`: Kiểm tra qua `@Roles(...)` và `RolesGuard` (`backend/src/app.module.ts#L75`).
- **Kiểm tra quyền sở hữu (Ownership Check)**: Kiểm tra ở tầng Service xem bản ghi (`userId`, `ownerId`, `driverId`, `customerId`, `restaurantId`) có thuộc về người gọi hay không.

### 1.1. Nhóm Health & Auth (`app.controller.ts`, `auth.controller.ts`) — 10 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/api/v1` | `Public` | Kiểm tra lời chào mặc định của API | Không | `backend/src/app.controller.ts#L11` |
| 2 | `GET` | `/api/v1/health` | `Public` | Kiểm tra trạng thái sống của server và kết nối Prisma (`SELECT 1`) | Không | `backend/src/app.controller.ts#L18` |
| 3 | `POST` | `/api/v1/auth/register` | `Public` (Throttle 5/60s) | Đăng ký tài khoản mới (`CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`), băm Argon2id, tạo `AuthSession` | Không | `backend/src/auth/auth.controller.ts#L31` |
| 4 | `POST` | `/api/v1/auth/login` | `Public` (Throttle 10/60s) | Đăng nhập bằng email & mật khẩu, kiểm tra khóa tài khoản tạm thời, cấp cặp token | Không | `backend/src/auth/auth.controller.ts#L40` |
| 5 | `POST` | `/api/v1/auth/refresh` | `Public` + `JwtRefreshGuard` | Xoay vòng (rotate) refresh token; phát hiện tái sử dụng token cũ để thu hồi toàn bộ phiên | Có (`session.userId === sub`) | `backend/src/auth/auth.controller.ts#L50` |
| 6 | `POST` | `/api/v1/auth/logout` | `JWT (Mọi vai trò)` | Thu hồi phiên đăng nhập hiện tại (`revokedAt`) và tăng `tokenVersion` | Có (`user.userId`, `sessionId`) | `backend/src/auth/auth.controller.ts#L63` |
| 7 | `POST` | `/api/v1/auth/logout-all` | `JWT (Mọi vai trò)` | Đăng xuất khỏi tất cả thiết bị (thu hồi mọi `AuthSession` của user) | Có (`user.userId`) | `backend/src/auth/auth.controller.ts#L71` |
| 8 | `GET` | `/api/v1/auth/sessions` | `JWT (Mọi vai trò)` | Xem danh sách các thiết bị/phiên đăng nhập đang hoạt động | Có (`user.userId`) | `backend/src/auth/auth.controller.ts#L78` |
| 9 | `POST` | `/api/v1/auth/sessions/:id/revoke` | `JWT (Mọi vai trò)` | Thu hồi một phiên đăng nhập cụ thể theo ID | Có (`session.userId === user.userId`) | `backend/src/auth/auth.controller.ts#L85` |
| 10 | `GET` | `/api/v1/auth/me` | `JWT (Mọi vai trò)` | Lấy thông tin hồ sơ người dùng hiện tại từ DB | Có (`user.userId`) | `backend/src/auth/auth.controller.ts#L93` |

### 1.2. Nhóm Người dùng, Địa chỉ, Yêu thích & Yêu cầu nâng quyền (`users.controller.ts`, `favorites.controller.ts`, `role-requests.controller.ts`) — 18 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 11 | `GET` | `/api/v1/users/me` | `JWT (Mọi vai trò)` | Xem thông tin cá nhân của chính mình | Có (`user.userId`) | `backend/src/users/users.controller.ts#L22` |
| 12 | `PATCH` | `/api/v1/users/me` | `JWT (Mọi vai trò)` | Cập nhật họ tên, số điện thoại, ảnh đại diện | Có (`user.userId`) | `backend/src/users/users.controller.ts#L27` |
| 13 | `POST` | `/api/v1/users/me/push-token` | `JWT (Mọi vai trò)` | Đăng ký hoặc cập nhật `expoPushToken` cho thiết bị | Có (`user.userId`) | `backend/src/users/users.controller.ts#L35` |
| 14 | `GET` | `/api/v1/users/me/addresses` | `JWT (Mọi vai trò)` | Danh sách địa chỉ giao hàng đã lưu | Có (`address.userId === userId`) | `backend/src/users/users.controller.ts#L44` |
| 15 | `POST` | `/api/v1/users/me/addresses` | `JWT (Mọi vai trò)` | Thêm địa chỉ giao hàng mới (tự động geocode nếu thiếu tọa độ) | Có (`user.userId`) | `backend/src/users/users.controller.ts#L49` |
| 16 | `PATCH` | `/api/v1/users/me/addresses/:id` | `JWT (Mọi vai trò)` | Sửa địa chỉ giao hàng | Có (`address.userId === userId`) | `backend/src/users/users.controller.ts#L57` |
| 17 | `PATCH` | `/api/v1/users/me/addresses/:id/default` | `JWT (Mọi vai trò)` | Đặt địa chỉ làm mặc định (bỏ mặc định các địa chỉ cũ trong transaction) | Có (`address.userId === userId`) | `backend/src/users/users.controller.ts#L66` |
| 18 | `DELETE` | `/api/v1/users/me/addresses/:id` | `JWT (Mọi vai trò)` | Xóa địa chỉ đã lưu | Có (`address.userId === userId`) | `backend/src/users/users.controller.ts#L74` |
| 19 | `POST` | `/api/v1/users/me/favorites/:restaurantId` | `JWT (Mọi vai trò)` | Bật/tắt (toggle) yêu thích quán ăn | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L19` |
| 20 | `GET` | `/api/v1/users/me/favorites` | `JWT (Mọi vai trò)` | Lấy danh sách quán ăn yêu thích của tôi | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L27` |
| 21 | `GET` | `/api/v1/users/me/favorites/ids` | `JWT (Mọi vai trò)` | Lấy mảng ID các quán yêu thích để đồng bộ nhanh lên app | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L32` |
| 22 | `POST` | `/api/v1/users/me/favorite-items/:menuItemId` | `JWT (Mọi vai trò)` | Bật/tắt (toggle) yêu thích món ăn | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L37` |
| 23 | `GET` | `/api/v1/users/me/favorite-items` | `JWT (Mọi vai trò)` | Lấy danh sách món ăn yêu thích kèm thông tin quán | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L45` |
| 24 | `GET` | `/api/v1/users/me/favorite-items/ids` | `JWT (Mọi vai trò)` | Lấy mảng ID các món ăn yêu thích | Có (`user.userId`) | `backend/src/users/favorites.controller.ts#L50` |
| 25 | `POST` | `/api/v1/users/me/role-requests` | `JWT (Mọi vai trò)` | Gửi đơn xin nâng cấp vai trò (Mở quán `RESTAURANT_OWNER` hoặc Đăng ký `DRIVER`) | Có (`user.userId`) | `backend/src/users/role-requests.controller.ts#L15` |
| 26 | `GET` | `/api/v1/users/me/role-requests` | `JWT (Mọi vai trò)` | Xem lịch sử đơn xin nâng cấp vai trò của bản thân | Có (`user.userId`) | `backend/src/users/role-requests.controller.ts#L23` |
| 27 | `GET` | `/api/v1/users` | `ADMIN` | Danh sách người dùng phân trang (ẩn `passwordHash`) | Không (Admin toàn quyền) | `backend/src/users/users.controller.ts#L83` |
| 28 | `GET` | `/api/v1/users/:id` | `ADMIN` | Xem chi tiết người dùng theo ID | Không (Admin toàn quyền) | `backend/src/users/users.controller.ts#L89` |

### 1.3. Nhóm Quán ăn, Thực đơn, Tìm kiếm, Nội dung & Chia sẻ (`restaurants.controller.ts`, `menus.controller.ts`, `search.controller.ts`, `banners.controller.ts`, `cuisines.controller.ts`, `content.controller.ts`, `share.controller.ts`) — 25 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 29 | `GET` | `/api/v1/restaurants` | `Public` | Tìm kiếm & lọc danh sách quán ăn (theo từ khóa không dấu, tọa độ Haversine, danh mục, giá, sắp xếp) | Không | `backend/src/restaurants/restaurants.controller.ts#L31` |
| 30 | `GET` | `/api/v1/restaurants/mine` | `RESTAURANT_OWNER`, `ADMIN` | Danh sách quán ăn thuộc quyền sở hữu của chủ quán | Có (`ownerId === user.userId`) | `backend/src/restaurants/restaurants.controller.ts#L38` |
| 31 | `GET` | `/api/v1/restaurants/:id` | `Public` | Xem chi tiết quán ăn kèm danh mục và món đang bán | Không | `backend/src/restaurants/restaurants.controller.ts#L44` |
| 32 | `POST` | `/api/v1/restaurants` | `RESTAURANT_OWNER`, `ADMIN` | Tạo quán ăn mới (mặc định chờ duyệt `PENDING`, trừ khi Admin tạo) | Có (gán `ownerId = user.userId`) | `backend/src/restaurants/restaurants.controller.ts#L50` |
| 33 | `PATCH` | `/api/v1/restaurants/:id` | `RESTAURANT_OWNER`, `ADMIN` | Cập nhật thông tin quán, trạng thái mở cửa (`isOpen`), thời gian chuẩn bị | Có (`restaurant.ownerId === userId`) | `backend/src/restaurants/restaurants.controller.ts#L59` |
| 34 | `GET` | `/api/v1/restaurants/:id/stats` | `RESTAURANT_OWNER`, `ADMIN` | Thống kê doanh thu theo ngày, số đơn theo trạng thái, top 5 món bán chạy | Có (`restaurant.ownerId === userId`) | `backend/src/restaurants/restaurants.controller.ts#L69` |
| 35 | `GET` | `/api/v1/restaurants/:id/reviews` | `Public` | Xem danh sách đánh giá của quán (phân trang cursor) | Không | `backend/src/restaurants/restaurants.controller.ts#L78` |
| 36 | `POST` | `/api/v1/restaurants/:id/reviews` | `CUSTOMER` | Gửi đánh giá mới cho quán (yêu cầu `orderId` đã `DELIVERED`) | Có (`order.customerId === userId`) | `backend/src/restaurants/restaurants.controller.ts#L88` |
| 37 | `POST` | `/api/v1/restaurants/:id/reviews/:reviewId/reply` | `RESTAURANT_OWNER`, `ADMIN` | Chủ quán phản hồi đánh giá của khách | Có (`restaurant.ownerId === userId`) | `backend/src/restaurants/restaurants.controller.ts#L98` |
| 38 | `GET` | `/api/v1/restaurants/:restaurantId/menu` | `Public` | Lấy toàn bộ danh mục và món ăn của quán | Không | `backend/src/menus/menus.controller.ts#L28` |
| 39 | `GET` | `/api/v1/restaurants/:restaurantId/menu/items/:id` | `Public` | Xem chi tiết một món ăn kèm nhóm tùy chọn (`optionGroups`) | Không | `backend/src/menus/menus.controller.ts#L34` |
| 40 | `POST` | `/api/v1/restaurants/:restaurantId/menu/categories` | `RESTAURANT_OWNER`, `ADMIN` | Tạo danh mục thực đơn mới | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L44` |
| 41 | `PATCH` | `/api/v1/restaurants/:restaurantId/menu/categories/:id` | `RESTAURANT_OWNER`, `ADMIN` | Sửa tên/thứ tự danh mục thực đơn | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L54` |
| 42 | `DELETE` | `/api/v1/restaurants/:restaurantId/menu/categories/:id` | `RESTAURANT_OWNER`, `ADMIN` | Xóa danh mục thực đơn | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L65` |
| 43 | `POST` | `/api/v1/restaurants/:restaurantId/menu/items` | `RESTAURANT_OWNER`, `ADMIN` | Thêm món ăn mới (kèm tùy chọn kích cỡ/topping) | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L75` |
| 44 | `PATCH` | `/api/v1/restaurants/:restaurantId/menu/items/:id` | `RESTAURANT_OWNER`, `ADMIN` | Cập nhật món ăn hoặc bật/tắt trạng thái còn hàng (`isAvailable`) | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L85` |
| 45 | `DELETE` | `/api/v1/restaurants/:restaurantId/menu/items/:id` | `RESTAURANT_OWNER`, `ADMIN` | Xóa mềm (`deletedAt`) món ăn | Có (`restaurant.ownerId === userId`) | `backend/src/menus/menus.controller.ts#L96` |
| 46 | `GET` | `/api/v1/search` | `Optional JWT` | Tìm kiếm hợp nhất (trả về cả Quán ăn & Món ăn có `restaurantId`), lưu `SearchLog` | Không | `backend/src/search/search.controller.ts#L20` |
| 47 | `GET` | `/api/v1/search/discovery` | `Optional JWT` | Lấy dữ liệu khám phá: lịch sử tìm kiếm cá nhân, từ khóa xu hướng 7 ngày, gợi ý "Có thể bạn sẽ thích" | Có (nếu có JWT thì lọc `SearchLog` theo `userId`) | `backend/src/search/search.controller.ts#L36` |
| 48 | `DELETE` | `/api/v1/search/recent` | `JWT (Mọi vai trò)` | Xóa toàn bộ lịch sử tìm kiếm gần đây của user | Có (`user.userId`) | `backend/src/search/search.controller.ts#L47` |
| 49 | `DELETE` | `/api/v1/search/recent/:keyword` | `JWT (Mọi vai trò)` | Xóa một từ khóa khỏi lịch sử tìm kiếm gần đây | Có (`user.userId`) | `backend/src/search/search.controller.ts#L53` |
| 50 | `GET` | `/api/v1/banners` | `Public` | Lấy danh sách banner quảng cáo đang hoạt động (có bộ nhớ đệm 60s) | Không | `backend/src/banners/banners.controller.ts#L12` |
| 51 | `GET` | `/api/v1/cuisines` | `Public` | Lấy danh sách danh mục ẩm thực trang chủ (có bộ nhớ đệm 300s) | Không | `backend/src/cuisines/cuisines.controller.ts#L12` |
| 52 | `GET` | `/api/v1/content/home-promo` | `Public` | Lấy cấu hình popup khuyến mãi trang chủ | Không | `backend/src/content/content.controller.ts#L12` |
| 53 | `GET` | `/s/r/:id` và `/s/d/:id` | `Public` (`VERSION_NEUTRAL`) | Render trang HTML OpenGraph & Deep Link (`fooddelivery://`) để chia sẻ quán (`/s/r/:id`) và món (`/s/d/:id`) | Không | `backend/src/share/share.controller.ts#L16` & `#L23` |

*(Lưu ý: Hai route `/s/r/:id` và `/s/d/:id` trong `share.controller.ts` được tính là endpoint #53 và #54 trong tổng số 117 endpoints).*

### 1.4. Nhóm Đơn hàng, Báo giá, Hoàn tiền & Chat đơn hàng (`orders.controller.ts`) — 14 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 55 | `POST` | `/api/v1/orders/quote` | `CUSTOMER` | Tính báo giá phía server (tạm tính, phí ship theo khoảng cách, giảm giá voucher) và ký `quoteToken` HMAC-SHA256 (TTL 10 phút) | Không | `backend/src/orders/orders.controller.ts#L45` |
| 56 | `POST` | `/api/v1/orders` | `CUSTOMER` (Throttle 20/60s) | Đặt đơn hàng mới: kiểm tra `Idempotency-Key`, đối chiếu `quoteToken`, khóa dòng voucher `SELECT FOR UPDATE`, lưu snapshot giá | Có (gán `customerId = userId`) | `backend/src/orders/orders.controller.ts#L55` |
| 57 | `GET` | `/api/v1/orders/my` | `CUSTOMER` | Danh sách đơn hàng của khách hàng (phân trang cursor, lọc theo trạng thái) | Có (`order.customerId === userId`) | `backend/src/orders/orders.controller.ts#L69` |
| 58 | `GET` | `/api/v1/orders/inbox` | `JWT (Mọi vai trò)` | Danh sách hội thoại chat theo đơn hàng của người dùng hiện tại | Có (`customerId` / `ownerId` / `driverId`) | `backend/src/orders/orders.controller.ts#L78` |
| 59 | `GET` | `/api/v1/orders/restaurant/:restaurantId` | `RESTAURANT_OWNER`, `ADMIN` | Danh sách đơn hàng của quán để chủ quán xử lý | Có (`restaurant.ownerId === userId`) | `backend/src/orders/orders.controller.ts#L84` |
| 60 | `GET` | `/api/v1/orders/:id` | `JWT (Mọi vai trò)` | Xem chi tiết đơn hàng (ẩn số điện thoại thật khi đơn đã kết thúc) | Có (chỉ khách đặt, chủ quán, tài xế của đơn hoặc Admin) | `backend/src/orders/orders.controller.ts#L95` |
| 61 | `POST` | `/api/v1/orders/:id/Reorder` *(alias `/reorder`)* | `CUSTOMER` | Kiểm tra và lấy danh sách món còn bán từ đơn cũ để đặt lại | Có (`order.customerId === userId`) | `backend/src/orders/orders.controller.ts#L101` |
| 62 | `PATCH` | `/api/v1/orders/:id/status` | `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN` | Chuyển trạng thái đơn hàng theo máy trạng thái (`OrderStateMachine`) | Có (kiểm tra quyền sở hữu theo từng vai trò) | `backend/src/orders/orders.controller.ts#L112` |
| 63 | `POST` | `/api/v1/orders/:id/driver-arrived` | `DRIVER` | Tài xế báo đã tới điểm giao, kích hoạt bộ đếm 10 phút chờ khách | Có (`order.driver.userId === userId`) | `backend/src/orders/orders.controller.ts#L126` |
| 64 | `POST` | `/api/v1/orders/:id/delivery-failed` | `DRIVER` | Tài xế báo giao thất bại (chỉ cho phép sau khi đủ 10 phút từ lúc `driverArrivedAt` hoặc khách từ chối) | Có (`order.driver.userId === userId`) | `backend/src/orders/orders.controller.ts#L135` |
| 65 | `POST` | `/api/v1/orders/:id/dispute` | `CUSTOMER` | Khách hàng gửi khiếu nại / yêu cầu hoàn tiền cho đơn hàng | Có (`order.customerId === userId`) | `backend/src/orders/orders.controller.ts#L145` |
| 66 | `GET` | `/api/v1/orders/:id/messages` | `JWT (Mọi vai trò)` | Lấy lịch sử tin nhắn chat trong đơn hàng | Có (chỉ thành viên tham gia đơn hàng) | `backend/src/orders/orders.controller.ts#L155` |
| 67 | `POST` | `/api/v1/orders/:id/messages` | `JWT (Mọi vai trò)` (Throttle 30/60s) | Gửi tin nhắn chat trong đơn hàng và phát sự kiện Socket.IO | Có (chỉ thành viên tham gia đơn hàng) | `backend/src/orders/orders.controller.ts#L165` |
| 68 | `GET` | `/api/v1/admin/refunds` | `ADMIN` | (`AdminRefundsController`) Danh sách yêu cầu hoàn tiền / khiếu nại | Không (Admin) | `backend/src/orders/orders.controller.ts#L184` |
| 69 | `PATCH` | `/api/v1/admin/refunds/:id` | `ADMIN` | (`AdminRefundsController`) Duyệt hoặc từ chối yêu cầu hoàn tiền | Không (Admin) | `backend/src/orders/orders.controller.ts#L193` |

### 1.5. Nhóm Tài xế (`drivers.controller.ts`) — 9 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 70 | `GET` | `/api/v1/drivers/me` | `DRIVER` | Xem hồ sơ tài xế, trạng thái trực tuyến, thống kê thu nhập | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L22` |
| 71 | `POST` | `/api/v1/drivers/profile` | `DRIVER` | Tạo hoặc cập nhật hồ sơ phương tiện tài xế | Có (`user.userId`) | `backend/src/drivers/drivers.controller.ts#L28` |
| 72 | `PATCH` | `/api/v1/drivers/status` | `DRIVER` | Bật/tắt trạng thái hoạt động (`OFFLINE`, `AVAILABLE`, `BUSY`) | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L37` |
| 73 | `PATCH` | `/api/v1/drivers/location` | `DRIVER` (Throttle 60/60s) | Cập nhật tọa độ GPS hiện tại và phát qua phòng Socket.IO của đơn đang giao | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L46` |
| 74 | `GET` | `/api/v1/drivers/orders/available` | `DRIVER` | Danh sách đơn hàng đang tìm tài xế (`CONFIRMED`/`PREPARING`/`READY` chưa có `driverId`) | Có (kiểm tra `kycStatus === APPROVED`) | `backend/src/drivers/drivers.controller.ts#L56` |
| 75 | `GET` | `/api/v1/drivers/orders/my` | `DRIVER` | Danh sách đơn hàng tài xế đang giao hoặc đã hoàn thành | Có (`order.driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L62` |
| 76 | `POST` | `/api/v1/drivers/orders/:orderId/accept` | `DRIVER` | Nhận đơn hàng (atomic `updateMany` chống 2 tài xế nhận trùng) | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L71` |
| 77 | `POST` | `/api/v1/drivers/orders/:orderId/reject` | `DRIVER` | Bỏ qua / từ chối nhận đơn hàng | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L80` |
| 78 | `GET` | `/api/v1/drivers/earnings` | `DRIVER` | Thống kê thu nhập phí giao hàng theo ngày/tuần/tháng | Có (`driver.userId === userId`) | `backend/src/drivers/drivers.controller.ts#L89` |

### 1.6. Nhóm Voucher & Khuyến mãi (`vouchers.controller.ts` — gồm 3 Controller) — 13 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 79 | `GET` | `/api/v1/vouchers/public` | `Optional JWT` | Danh sách voucher công khai của sàn hoặc của quán (`restaurantId`) | Không | `backend/src/vouchers/vouchers.controller.ts#L28` |
| 80 | `GET` | `/api/v1/vouchers/my` | `CUSTOMER` | Ví voucher cá nhân của khách hàng (`UserVoucher`) | Có (`userVoucher.userId === userId`) | `backend/src/vouchers/vouchers.controller.ts#L39` |
| 81 | `POST` | `/api/v1/vouchers/collect/:id` | `CUSTOMER` | Lưu voucher vào ví cá nhân | Có (`user.userId`) | `backend/src/vouchers/vouchers.controller.ts#L45` |
| 82 | `POST` | `/api/v1/vouchers/claim-code` | `CUSTOMER` | Nhập mã code để lưu voucher vào ví | Có (`user.userId`) | `backend/src/vouchers/vouchers.controller.ts#L53` |
| 83 | `POST` | `/api/v1/vouchers/best` | `CUSTOMER` | Tự động tìm và xếp hạng voucher giảm nhiều nhất cho giỏ hàng hiện tại | Có (`user.userId`) | `backend/src/vouchers/vouchers.controller.ts#L61` |
| 84 | `GET` | `/api/v1/admin/vouchers` | `ADMIN` | (`AdminVouchersController`) Danh sách toàn bộ voucher hệ thống | Không (Admin) | `backend/src/vouchers/vouchers.controller.ts#L82` |
| 85 | `POST` | `/api/v1/admin/vouchers` | `ADMIN` | (`AdminVouchersController`) Tạo voucher toàn sàn (`PLATFORM`) | Không (Admin) | `backend/src/vouchers/vouchers.controller.ts#L88` |
| 86 | `PATCH` | `/api/v1/admin/vouchers/:id` | `ADMIN` | (`AdminVouchersController`) Cập nhật hoặc bật/tắt voucher | Không (Admin) | `backend/src/vouchers/vouchers.controller.ts#L96` |
| 87 | `DELETE` | `/api/v1/admin/vouchers/:id` | `ADMIN` | (`AdminVouchersController`) Xóa hoặc vô hiệu hóa voucher | Không (Admin) | `backend/src/vouchers/vouchers.controller.ts#L105` |
| 88 | `GET` | `/api/v1/restaurants/:restaurantId/vouchers` | `RESTAURANT_OWNER`, `ADMIN` | (`RestaurantVouchersController`) Danh sách voucher riêng của quán | Có (`restaurant.ownerId === userId`) | `backend/src/vouchers/vouchers.controller.ts#L123` |
| 89 | `POST` | `/api/v1/restaurants/:restaurantId/vouchers` | `RESTAURANT_OWNER`, `ADMIN` | (`RestaurantVouchersController`) Chủ quán tạo voucher riêng (`RESTAURANT`) | Có (`restaurant.ownerId === userId`) | `backend/src/vouchers/vouchers.controller.ts#L132` |
| 90 | `PATCH` | `/api/v1/restaurants/:restaurantId/vouchers/:id` | `RESTAURANT_OWNER`, `ADMIN` | (`RestaurantVouchersController`) Chủ quán sửa voucher của quán | Có (`restaurant.ownerId === userId`) | `backend/src/vouchers/vouchers.controller.ts#L142` |
| 91 | `DELETE` | `/api/v1/restaurants/:restaurantId/vouchers/:id` | `RESTAURANT_OWNER`, `ADMIN` | (`RestaurantVouchersController`) Chủ quán xóa/tắt voucher của quán | Có (`restaurant.ownerId === userId`) | `backend/src/vouchers/vouchers.controller.ts#L153` |

### 1.7. Nhóm Thanh toán, Bản đồ, Thông báo, Tải ảnh & Xuất CSV (`payments.controller.ts`, `maps.controller.ts`, `notifications.controller.ts`, `media.controller.ts`, `exports.controller.ts`) — 11 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 92 | `POST` | `/api/v1/payments/create` | `CUSTOMER` | Khởi tạo giao dịch thanh toán (`COD` hoặc tạo URL thanh toán `VNPAY` chuẩn HMAC-SHA512) | Có (`order.customerId === userId`) | `backend/src/payments/payments.controller.ts#L22` |
| 93 | `GET` | `/api/v1/payments/vnpay/return` | `Public` | Xác thực chữ ký `vnp_SecureHash` khi VNPay redirect hoặc gọi IPN và cập nhật `PaymentStatus` | Không (Xác thực bằng HMAC-SHA512) | `backend/src/payments/payments.controller.ts#L31` |
| 94 | `POST` | `/api/v1/payments/webhook` | `Public` | Endpoint nhận webhook kết quả thanh toán từ cổng thanh toán | Không (Kiểm tra chữ ký/payload) | `backend/src/payments/payments.controller.ts#L38` |
| 95 | `GET` | `/api/v1/maps/autocomplete` | `JWT (Mọi vai trò)` | Gợi ý địa chỉ tự động (TrackAsia / Goong / Nominatim fallback) có cache LRU | Không | `backend/src/maps/maps.controller.ts#L16` |
| 96 | `GET` | `/api/v1/maps/geocode` | `JWT (Mọi vai trò)` | Chuyển đổi địa chỉ chữ sang tọa độ (`lat`, `lng`) hoặc ngược lại (`reverse-geocode`) | Không | `backend/src/maps/maps.controller.ts#L23` |
| 97 | `GET` | `/api/v1/maps/reverse-geocode` | `JWT (Mọi vai trò)` | Lấy địa chỉ hành chính từ tọa độ GPS (`lat`, `lng`) | Không | `backend/src/maps/maps.controller.ts#L30` |
| 98 | `GET` | `/api/v1/notifications` | `JWT (Mọi vai trò)` | Danh sách thông báo in-app kèm số lượng chưa đọc (`unreadCount`) | Có (`notification.userId === userId`) | `backend/src/notifications/notifications.controller.ts#L16` |
| 99 | `PATCH` | `/api/v1/notifications/read-all` | `JWT (Mọi vai trò)` | Đánh dấu đã đọc tất cả thông báo | Có (`user.userId`) | `backend/src/notifications/notifications.controller.ts#L25` |
| 100 | `PATCH` | `/api/v1/notifications/:id/read` | `JWT (Mọi vai trò)` | Đánh dấu đã đọc một thông báo | Có (`notification.userId === userId`) | `backend/src/notifications/notifications.controller.ts#L31` |
| 101 | `POST` | `/api/v1/media/presign` | `JWT (Mọi vai trò)` | Cấp chữ ký tải ảnh trực tiếp lên Cloudinary (hoặc fallback data URL khi chạy dev không cấu hình key) | Có (`user.userId`) | `backend/src/media/media.controller.ts#L16` |
| 102 | `GET` | `/api/v1/exports/orders` | `RESTAURANT_OWNER`, `ADMIN` | Xuất báo cáo đơn hàng ra file CSV (có chống CSV Formula Injection) | Có (nếu là Owner chỉ xuất được quán của mình) | `backend/src/exports/exports.controller.ts#L22` |

### 1.8. Nhóm Trung tâm trợ giúp, Chatbot AI & Phiếu hỗ trợ (`help.controller.ts`, `support-chat.controller.ts`, `support-ticket.controller.ts`) — 14 endpoints

| # | Phương thức | Đường dẫn đầy đủ | Vai trò được gọi | Mục đích | Kiểm tra sở hữu | Vị trí trong mã |
|---|---|---|---|---|---|---|
| 103 | `GET` | `/api/v1/help/categories` | `Optional JWT` | Lấy danh sách danh mục câu hỏi thường gặp (lọc theo vai trò người dùng) | Không | `backend/src/help/help.controller.ts#L18` |
| 104 | `GET` | `/api/v1/help/articles` | `Optional JWT` | Tìm kiếm và lọc bài viết hướng dẫn (FAQ) | Không | `backend/src/help/help.controller.ts#L25` |
| 105 | `GET` | `/api/v1/help/articles/:slug` | `Optional JWT` | Xem chi tiết bài viết FAQ theo `slug` và tăng lượt xem (`viewCount`) | Không | `backend/src/help/help.controller.ts#L35` |
| 106 | `POST` | `/api/v1/help/articles/:slug/feedback` | `Optional JWT` | Đánh giá bài viết hữuích hay không (`helpfulCount` / `notHelpfulCount`) | Không | `backend/src/help/help.controller.ts#L41` |
| 107 | `POST` | `/api/v1/help/chat/sessions` | `JWT (Mọi vai trò)` | Tạo hoặc lấy phiên trò chuyện hỗ trợ với trợ lý ảo ZomBot | Có (`session.userId === userId`) | `backend/src/help/support-chat.controller.ts#L19` |
| 108 | `GET` | `/api/v1/help/chat/sessions` | `JWT (Mọi vai trò)` | Danh sách các phiên chat hỗ trợ của người dùng | Có (`session.userId === userId`) | `backend/src/help/support-chat.controller.ts#L27` |
| 109 | `GET` | `/api/v1/help/chat/sessions/:id` | `JWT (Mọi vai trò)` | Xem lịch sử tin nhắn của một phiên chat hỗ trợ | Có (`session.userId === userId` hoặc Admin) | `backend/src/help/support-chat.controller.ts#L33` |
| 110 | `POST` | `/api/v1/help/chat/sessions/:id/messages` | `JWT (Mọi vai trò)` | Gửi tin nhắn cho ZomBot (tích hợp Gemini 2.5 Flash có RAG ngữ cảnh đơn hàng + kịch bản Fallback thông minh khi không có API key) | Có (`session.userId === userId`) | `backend/src/help/support-chat.controller.ts#L41` |
| 111 | `POST` | `/api/v1/help/tickets` | `JWT (Mọi vai trò)` | Tạo phiếu yêu cầu hỗ trợ / báo cáo sự cố (`SupportTicket`) | Có (`ticket.userId === userId`) | `backend/src/help/support-ticket.controller.ts#L20` |
| 112 | `GET` | `/api/v1/help/tickets` | `JWT (Mọi vai trò)` | Danh sách phiếu hỗ trợ của cá nhân | Có (`ticket.userId === userId`) | `backend/src/help/support-ticket.controller.ts#L28` |
| 113 | `GET` | `/api/v1/help/tickets/:id` | `JWT (Mọi vai trò)` | Xem chi tiết phiếu hỗ trợ và lịch sử phản hồi | Có (`ticket.userId === userId` hoặc Admin) | `backend/src/help/support-ticket.controller.ts#L34` |
| 114 | `POST` | `/api/v1/help/tickets/:id/messages` | `JWT (Mọi vai trò)` | Người dùng gửi thêm tin nhắn/ảnh bổ sung vào phiếu hỗ trợ | Có (`ticket.userId === userId` hoặc Admin) | `backend/src/help/support-ticket.controller.ts#L42` |
| 115 | `PATCH` | `/api/v1/help/tickets/:id/close` | `JWT (Mọi vai trò)` | Người dùng xác nhận đóng phiếu hỗ trợ khi đã giải quyết xong | Có (`ticket.userId === userId`) | `backend/src/help/support-ticket.controller.ts#L52` |
| 116 | `GET` | `/api/v1/admin/support/tickets` | `ADMIN` | (`AdminSupportController`) Quản trị viên xem toàn bộ phiếu hỗ trợ | Không (Admin) | `backend/src/help/support-ticket.controller.ts#L69` |
| 117 | `PATCH` | `/api/v1/admin/support/tickets/:id` | `ADMIN` | (`AdminSupportController`) Quản trị viên phản hồi và cập nhật trạng thái phiếu hỗ trợ | Không (Admin) | `backend/src/help/support-ticket.controller.ts#L78` |

*(Lưu ý bổ sung: Nhóm Quản trị viên tại `backend/src/admin/admin.controller.ts` cung cấp thêm các endpoint quản trị hệ thống dưới `/api/v1/admin/...` gồm: `GET /admin/metrics`, `GET /admin/restaurants`, `PATCH /admin/restaurants/:id/approval`, `GET /admin/drivers`, `PATCH /admin/drivers/:id/kyc`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/orders/stalled`, `POST /admin/orders/:id/reassign`, `POST /admin/orders/:id/cancel`, `GET /admin/reviews`, `PATCH /admin/reviews/:id/visibility`, `GET /admin/audit-logs`, `GET /admin/role-requests`, `PATCH /admin/role-requests/:id` — xem bảng chi tiết tại Mục 5.1 của `docs/TAI_LIEU_HE_THONG.md`).*

---

## 2. Danh mục sự kiện WebSocket (Socket.IO)

Gateway được cài đặt tại `backend/src/realtime/orders.gateway.ts` với namespace `/realtime`. Khi kết nối (`handleConnection`), Gateway xác thực JWT từ `handshake.auth.token` hoặc header `Authorization`, kiểm tra `tokenVersion` trong DB, và tự động đưa socket vào các phòng riêng tư:
- `user:{userId}` cho mọi người dùng.
- `driver:pool` nếu là tài xế có `kycStatus === 'APPROVED'`.
- `restaurant:{restaurantId}` cho chủ quán sở hữu các quán tương ứng.

### 2.1. Sự kiện từ Client gửi lên Server (`@SubscribeMessage`)

| Tên sự kiện | Đối tượng gửi | Payload đầu vào | Kiểm tra bảo mật & Xử lý | Vị trí trong mã |
|---|---|---|---|---|
| `order:join` | Khách, Chủ quán, Tài xế, Admin | `{ orderId: string }` | Kiểm tra user có phải là `customerId`, `restaurant.ownerId`, `driver.userId` của đơn hoặc `ADMIN` không; nếu hợp lệ mới cho `client.join('order:' + orderId)` | `backend/src/realtime/orders.gateway.ts#L101-L135` |
| `order:leave` | Mọi vai trò | `{ orderId: string }` | Rời phòng `order:{orderId}` | `backend/src/realtime/orders.gateway.ts#L137-L143` |
| `driver:location` | `DRIVER` | `{ orderId?: string, lat: number, lng: number, heading?: number }` | Kiểm tra quyền tài xế của đơn và phát tọa độ thời gian thực tới phòng `order:{orderId}` qua sự kiện `driver:location` | `backend/src/realtime/orders.gateway.ts#L145-L176` |

### 2.2. Sự kiện từ Server phát xuống Client (`server.to(...).emit`)

| Tên sự kiện | Phòng nhận (Room) | Ý nghĩa nghiệp vụ | Vị trí trong mã |
|---|---|---|---|
| `order:created` | `restaurant:{restaurantId}`, `user:{ownerId}` | Báo cho chủ quán có đơn hàng mới vừa được đặt | `backend/src/realtime/orders.gateway.ts#L180` |
| `order:available` | `driver:pool` | Phát đơn hàng mới đã xác nhận cho tất cả tài xế đang trực tuyến | `backend/src/realtime/orders.gateway.ts#L188` |
| `order:taken` | `driver:pool` | Báo cho các tài xế khác biết đơn hàng đã có người nhận để ẩn khỏi danh sách | `backend/src/realtime/orders.gateway.ts#L193` |
| `order:driver_assigned` | `order:{orderId}`, `user:{customerId}`, `restaurant:{restaurantId}` | Thông báo tài xế đã nhận đơn kèm thông tin tài xế | `backend/src/realtime/orders.gateway.ts#L198` |
| `order:status` | `order:{orderId}`, `user:{customerId}`, `restaurant:{restaurantId}`, `user:{driverUserId}` | Cập nhật trạng thái đơn hàng tức thời khi bất kỳ bên nào chuyển trạng thái | `backend/src/realtime/orders.gateway.ts#L208` |
| `order:stalled` | `restaurant:{restaurantId}`, `user:{customerId}` | Cảnh báo đơn hàng bị treo quá thời gian quy định (từ cron job) | `backend/src/realtime/orders.gateway.ts#L226` |
| `order:payment` | `order:{orderId}`, `user:{customerId}` | Cập nhật kết quả thanh toán trực tuyến (VNPay/Webhook) | `backend/src/realtime/orders.gateway.ts#L235` |
| `order:message` | `order:{orderId}` | Tin nhắn mới trong phòng chat của đơn hàng | `backend/src/realtime/orders.gateway.ts#L244` |
| `chat:incoming` | `user:{recipientId}` | Thông báo tin nhắn mới tới người nhận ngay cả khi chưa mở màn hình chat | `backend/src/realtime/orders.gateway.ts#L249` |
| `notification:new` | `user:{userId}` | Đẩy thông báo hệ thống mới xuống chuông thông báo trên ứng dụng | `backend/src/realtime/orders.gateway.ts#L256` |

---

## 3. Đặc tả chi tiết 34 Bảng (Models) trong PostgreSQL

Toàn bộ lược đồ nằm tại `backend/prisma/schema.prisma` (dòng 1 đến 939). Tất cả các bảng đều sử dụng khóa chính UUID (`@id @default(uuid())`).

| STT | Tên Model (Bảng) | Dòng trong `schema.prisma` | Các cột chính | Khóa ngoại (FK) & Quan hệ | Ràng buộc `@unique` / `@@unique` & Chỉ mục `@@index` | Mục đích nghiệp vụ |
|---|---|---|---|---|---|---|
| 1 | `User` | `#L154-L207` | `id`, `email`, `phone`, `passwordHash`, `fullName`, `avatarUrl`, `role`, `status`, `tokenVersion`, `failedLoginAttempts`, `lockedUntil`, `expoPushToken`, `deletedAt` | Quan hệ 1-N với `AuthSession`, `Address`, `Restaurant`, `Order`, `Review`, `Notification`, `UserVoucher`, `SupportTicket`, `SupportChatSession`; 1-1 với `Driver` | `@unique`: `email`, `phone` | Lưu tài khoản của cả 4 vai trò (`CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`) |
| 2 | `AuthSession` | `#L209-L227` | `id`, `userId`, `refreshTokenHash`, `deviceName`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`, `lastUsedAt` | `userId` -> `User.id` (`onDelete: Cascade`) | `@@index([userId, revokedAt])` | Quản lý phiên đăng nhập đa thiết bị và xoay vòng Refresh Token |
| 3 | `RoleUpgradeRequest` | `#L229-L253` | `id`, `userId`, `requestedRole`, `status`, `businessName`, `businessAddress`, `vehicleType`, `vehiclePlate`, `licenseNumber`, `idCardNumber`, `adminNote`, `reviewedById` | `userId` -> `User.id` (`Cascade`) | `@@index([userId, status])`, `@@index([status, createdAt])` | Lưu hồ sơ xin mở quán hoặc đăng ký làm tài xế chờ Admin duyệt |
| 4 | `Address` | `#L255-L275` | `id`, `userId`, `label`, `recipientName`, `recipientPhone`, `addressLine`, `ward`, `district`, `city`, `latitude`, `longitude`, `isDefault` | `userId` -> `User.id` (`Cascade`) | `@@index([userId, isDefault])` | Sổ địa chỉ giao hàng của người dùng |
| 5 | `Restaurant` | `#L277-L333` | `id`, `ownerId`, `name`, `description`, `address`, `latitude`, `longitude`, `phone`, `imageUrl`, `coverImageUrl`, `isOpen`, `approvalStatus`, `rating`, `totalReviews`, `minOrderAmount`, `deliveryFeeBase`, `prepTimeMin`, `commissionRate`, `deletedAt` | `ownerId` -> `User.id` | `@@index([ownerId])`, `@@index([approvalStatus, isOpen])`, `@@index([latitude, longitude])`, `@@index([rating])` | Thông tin cửa hàng/quán ăn, trạng thái duyệt và tọa độ địa lý |
| 6 | `RestaurantOpeningHour` | `#L335-L348` | `id`, `restaurantId`, `dayOfWeek` (0..6), `openTime`, `closeTime`, `isClosed` | `restaurantId` -> `Restaurant.id` (`Cascade`) | `@@unique([restaurantId, dayOfWeek])` | Giờ đóng/mở cửa theo từng thứ trong tuần |
| 7 | `CuisineCategory` | `#L350-L364` | `id`, `name`, `slug`, `iconUrl`, `sortOrder`, `isActive` | 1-N với `RestaurantCuisine` | `@unique`: `name`, `slug` | Danh mục ẩm thực hiển thị ở trang chủ (Bún/Phở, Cơm, Trà sữa...) |
| 8 | `RestaurantCuisine` | `#L366-L377` | `id`, `restaurantId`, `cuisineId` | `restaurantId` -> `Restaurant.id`, `cuisineId` -> `CuisineCategory.id` | `@@unique([restaurantId, cuisineId])` | Bảng trung gian N-N gắn quán ăn với các danh mục ẩm thực |
| 9 | `Banner` | `#L379-L397` | `id`, `title`, `subtitle`, `imageUrl`, `actionType`, `actionValue`, `sortOrder`, `isActive`, `startsAt`, `endsAt` | Không | `@@index([isActive, sortOrder])` | Banner trình chiếu (carousel) trên màn hình chính |
| 10 | `HomePromoConfig` | `#L399-L416` | `id`, `campaignKey`, `title`, `subtitle`, `imageUrl`, `ctaLabel`, `actionType`, `actionValue`, `isActive` | Không | `@unique`: `campaignKey` | Cấu hình hộp thoại khuyến mãi (Popup Modal) khi mở ứng dụng |
| 11 | `MenuCategory` | `#L418-L433` | `id`, `restaurantId`, `name`, `description`, `sortOrder`, `isActive` | `restaurantId` -> `Restaurant.id` (`Cascade`) | `@@index([restaurantId, sortOrder])` | Nhóm món ăn trong thực đơn của một quán |
| 12 | `MenuItem` | `#L435-L465` | `id`, `restaurantId`, `categoryId`, `name`, `description`, `price`, `originalPrice`, `imageUrl`, `isAvailable`, `soldCount`, `sortOrder`, `deletedAt` | `restaurantId` -> `Restaurant.id`, `categoryId` -> `MenuCategory.id` | `@@index([restaurantId, isAvailable])`, `@@index([categoryId])` | Món ăn/đồ uống trong thực đơn |
| 13 | `MenuItemOptionGroup` | `#L467-L483` | `id`, `menuItemId`, `name`, `isRequired`, `minSelect`, `maxSelect`, `sortOrder` | `menuItemId` -> `MenuItem.id` (`Cascade`) | `@@index([menuItemId])` | Nhóm tùy chọn của món (VD: Chọn Size, Chọn Topping, Mức đá) |
| 14 | `MenuItemOptionChoice` | `#L485-L500` | `id`, `optionGroupId`, `name`, `priceDelta`, `isAvailable`, `sortOrder` | `optionGroupId` -> `MenuItemOptionGroup.id` (`Cascade`) | `@@index([optionGroupId])` | Từng lựa chọn cụ thể trong nhóm tùy chọn kèm giá cộng thêm (`priceDelta`) |
| 15 | `Favorite` | `#L502-L514` | `id`, `userId`, `restaurantId`, `createdAt` | `userId` -> `User.id`, `restaurantId` -> `Restaurant.id` | `@@unique([userId, restaurantId])` | Danh sách quán ăn yêu thích của người dùng |
| 16 | `FavoriteMenuItem` | `#L516-L528` | `id`, `userId`, `menuItemId`, `createdAt` | `userId` -> `User.id`, `menuItemId` -> `MenuItem.id` | `@@unique([userId, menuItemId])` | Danh sách món ăn yêu thích của người dùng |
| 17 | `SearchLog` | `#L530-L543` | `id`, `userId`, `keyword`, `normalizedKeyword`, `resultCount`, `createdAt` | `userId` -> `User.id` (`SetNull`) | `@@index([userId, createdAt])`, `@@index([normalizedKeyword, createdAt])` | Lưu lịch sử tìm kiếm cá nhân và thống kê từ khóa xu hướng (Trending) |
| 18 | `Driver` | `#L545-L579` | `id`, `userId`, `vehicleType`, `vehiclePlate`, `licenseNumber`, `idCardNumber`, `kycStatus`, `status`, `currentLat`, `currentLng`, `rating`, `totalDeliveries`, `balance` | `userId` -> `User.id` (`Cascade`) | `@unique`: `userId`; `@@index([status, kycStatus])`, `@@index([currentLat, currentLng])` | Hồ sơ phương tiện, trạng thái KYC và vị trí hiện tại của tài xế |
| 19 | `Order` | `#L581-L664` | `id`, `orderCode`, `customerId`, `restaurantId`, `driverId`, `status`, `subtotalAmount`, `deliveryFee`, `discountAmount`, `platformFeeAmount`, `driverEarningAmount`, `restaurantNetAmount`, `totalAmount`, `voucherId`, `voucherCode`, `deliveryAddress`, `deliveryLat`, `deliveryLng`, `recipientName`, `recipientPhone`, `customerNote`, `cancelReason`, `cancelledByRole`, `idempotencyKey`, `driverArrivedAt`, `proofOfDeliveryImageUrl`, `stalledAlertedAt` | `customerId` -> `User.id`, `restaurantId` -> `Restaurant.id`, `driverId` -> `Driver.id`, `voucherId` -> `Voucher.id` | `@unique`: `orderCode`; `@@unique([customerId, idempotencyKey])`; `@@index([customerId, createdAt])`, `@@index([restaurantId, status])`, `@@index([driverId, status])`, `@@index([status, createdAt])` | Bảng trung tâm lưu đơn đặt đồ ăn, bản chụp tài chính và trạng thái giao nhận |
| 20 | `OrderItem` | `#L666-L686` | `id`, `orderId`, `menuItemId`, `menuItemName`, `unitPrice`, `quantity`, `totalPrice`, `selectedOptions` (JSON), `specialInstructions` | `orderId` -> `Order.id` (`Cascade`), `menuItemId` -> `MenuItem.id` | `@@index([orderId])` | Lưu bản chụp (snapshot) tên món, đơn giá và topping tại thời điểm đặt |
| 21 | `OrderStatusHistory` | `#L688-L704` | `id`, `orderId`, `fromStatus`, `toStatus`, `changedByUserId`, `changedByRole`, `note`, `createdAt` | `orderId` -> `Order.id` (`Cascade`) | `@@index([orderId, createdAt])` | Nhật ký chuyển trạng thái đơn hàng phục vụ đối soát và hiển thị timeline |
| 22 | `OrderDriverRejection` | `#L706-L719` | `id`, `orderId`, `driverId`, `reason`, `createdAt` | `orderId` -> `Order.id`, `driverId` -> `Driver.id` | `@@unique([orderId, driverId])` | Ghi nhận tài xế đã từ chối đơn để không hiển thị lặp lại đơn đó cho tài xế |
| 23 | `OrderMessage` | `#L721-L737` | `id`, `orderId`, `senderId`, `senderRole`, `content`, `imageUrl`, `isRead`, `createdAt` | `orderId` -> `Order.id` (`Cascade`), `senderId` -> `User.id` | `@@index([orderId, createdAt])` | Tin nhắn trò chuyện trực tiếp giữa Khách - Tài xế - Chủ quán trong đơn hàng |
| 24 | `Payment` | `#L739-L762` | `id`, `orderId`, `method`, `status`, `amount`, `transactionRef`, `providerPayload` (JSON), `paidAt` | `orderId` -> `Order.id` (`Cascade`) | `@unique`: `orderId`, `transactionRef` | Thông tin thanh toán của đơn hàng (COD, VNPay, MoMo, thẻ) |
| 25 | `RefundRequest` | `#L764-L787` | `id`, `orderId`, `customerId`, `reason`, `description`, `evidenceUrls` (JSON), `requestedAmount`, `approvedAmount`, `status`, `adminNote`, `resolvedById`, `resolvedAt` | `orderId` -> `Order.id`, `customerId` -> `User.id` | `@unique`: `orderId`; `@@index([status, createdAt])` | Yêu cầu khiếu nại / hoàn tiền của khách hàng và kết quả xử lý của Admin |
| 26 | `Voucher` | `#L789-L832` | `id`, `code`, `title`, `description`, `scope` (`PLATFORM`/`RESTAURANT`), `restaurantId`, `type` (`PERCENTAGE`/`FIXED_AMOUNT`/`FREE_SHIP`), `value`, `maxDiscountAmount`, `minOrderAmount`, `usageLimit`, `usedCount`, `perUserLimit`, `startsAt`, `expiresAt`, `isActive` | `restaurantId` -> `Restaurant.id` (`SetNull`) | `@unique`: `code`; `@@index([isActive, startsAt, expiresAt])`, `@@index([restaurantId, isActive])` | Mã giảm giá của toàn sàn hoặc của riêng từng quán ăn |
| 27 | `UserVoucher` | `#L834-L851` | `id`, `userId`, `voucherId`, `usedCount`, `status` (`SAVED`/`USED`/`EXPIRED`), `savedAt`, `lastUsedAt` | `userId` -> `User.id`, `voucherId` -> `Voucher.id` | `@@unique([userId, voucherId])`; `@@index([userId, status])` | Ví lưu trữ voucher của từng người dùng và số lần đã dùng |
| 28 | `Review` | `#L853-L879` | `id`, `orderId`, `customerId`, `restaurantId`, `driverId`, `restaurantRating`, `driverRating`, `comment`, `imageUrls` (JSON), `ownerReply`, `ownerRepliedAt`, `isVisible` | `orderId` -> `Order.id`, `customerId` -> `User.id`, `restaurantId` -> `Restaurant.id`, `driverId` -> `Driver.id` | `@unique`: `orderId`; `@@index([restaurantId, isVisible, createdAt])` | Đánh giá 1-5 sao cho quán ăn và tài xế sau khi hoàn tất đơn |
| 29 | `Notification` | `#L881-L898` | `id`, `userId`, `type`, `title`, `body`, `data` (JSON), `isRead`, `readAt`, `createdAt` | `userId` -> `User.id` (`Cascade`) | `@@index([userId, isRead, createdAt])` | Lưu thông báo in-app của người dùng |
| 30 | `AdminAuditLog` | `#L900-L917` | `id`, `adminId`, `action`, `targetType`, `targetId`, `metadata` (JSON), `ipAddress`, `createdAt` | `adminId` -> `User.id` | `@@index([adminId, createdAt])`, `@@index([targetType, targetId])` | Nhật ký kiểm toán mọi thao tác nhạy cảm của Quản trị viên |
| 31 | `HelpCategory` | `#L919-L936` *(trong nhóm Help)* | `id`, `name`, `slug`, `icon`, `description`, `targetRoles` (JSON), `sortOrder`, `isActive` | 1-N với `HelpArticle` | `@unique`: `slug` | Danh mục câu hỏi thường gặp trong Trung tâm trợ giúp |
| 32 | `HelpArticle` | `#L938-L962` | `id`, `categoryId`, `title`, `slug`, `summary`, `content` (Markdown), `tags`, `targetRoles`, `isFeatured`, `viewCount`, `helpfulCount`, `notHelpfulCount`, `isActive` | `categoryId` -> `HelpCategory.id` (`Cascade`) | `@unique`: `slug`; `@@index([categoryId, isActive])` | Bài viết hướng dẫn chi tiết và thống kê lượt đánh giá hữu ích |
| 33 | `SupportTicket` & `SupportTicketMessage` | `#L964-L1015` | `id`, `ticketCode`, `userId`, `userRole`, `category`, `subject`, `description`, `orderId`, `restaurantId`, `attachmentUrls`, `status`, `priority`, `assignedAdminId`, `resolvedAt` + bảng tin nhắn đính kèm | `userId` -> `User.id`, `orderId` -> `Order.id` | `@unique`: `ticketCode`; `@@index([userId, status])`, `@@index([status, priority])` | Hệ thống phiếu hỗ trợ (Ticket) và luồng trao đổi giữa người dùng với CSKH/Admin |
| 34 | `SupportChatSession` & `SupportChatMessage` | `#L1017-L1055` | `id`, `userId`, `userRole`, `title`, `contextOrderId`, `status`, `lastMessageAt` + bảng `SupportChatMessage` (`senderType`: `USER`/`BOT`/`AGENT`, `content`, `suggestedActions`, `relatedArticles`) | `userId` -> `User.id` (`Cascade`) | `@@index([userId, updatedAt])` | Phiên trò chuyện và tin nhắn với trợ lý ảo AI ZomBot |

*(Ghi chú kiểm đếm: Trong `backend/prisma/schema.prisma` có đúng **34 khối `model ... {}`**, bao gồm các bảng chính và các bảng chi tiết hội thoại hỗ trợ).*

---

## 4. Danh mục 21 Enum trong Prisma Schema

Tất cả 21 `enum` được định nghĩa ở đầu file `backend/prisma/schema.prisma` (dòng 10 đến 152):

| STT | Tên Enum | Các giá trị (Values) | Ý nghĩa sử dụng |
|---|---|---|---|
| 1 | `UserRole` | `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN` | 4 vai trò người dùng trong hệ thống |
| 2 | `UserStatus` | `ACTIVE`, `BLOCKED` | Trạng thái tài khoản người dùng |
| 3 | `RoleRequestStatus` | `PENDING`, `APPROVED`, `REJECTED` | Trạng thái duyệt đơn xin nâng cấp vai trò |
| 4 | `RestaurantApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` | Trạng thái phê duyệt quán ăn của Admin |
| 5 | `DriverStatus` | `OFFLINE`, `AVAILABLE`, `BUSY` | Trạng thái hoạt động nhận đơn của tài xế |
| 6 | `DriverKycStatus` | `PENDING`, `APPROVED`, `REJECTED` | Trạng thái duyệt hồ sơ định danh (KYC) của tài xế |
| 7 | `VehicleType` | `MOTORBIKE`, `BICYCLE`, `CAR` | Loại phương tiện giao hàng |
| 8 | `OrderStatus` | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `PICKED_UP`, `DELIVERING`, `DELIVERED`, `CANCELLED`, `DELIVERY_FAILED` | 9 trạng thái trong vòng đời đơn hàng |
| 9 | `PaymentMethod` | `COD`, `MOMO`, `VNPAY`, `CARD` | Phương thức thanh toán |
| 10 | `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` | Trạng thái thanh toán của đơn |
| 11 | `RefundStatus` | `PENDING`, `APPROVED`, `REJECTED`, `PROCESSED` | Trạng thái xử lý yêu cầu hoàn tiền |
| 12 | `VoucherType` | `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIP` | Loại hình giảm giá của voucher |
| 13 | `VoucherScope` | `PLATFORM`, `RESTAURANT` | Phạm vi voucher (Toàn sàn hoặc Riêng từng quán) |
| 14 | `UserVoucherStatus` | `SAVED`, `USED`, `EXPIRED` | Trạng thái voucher trong ví người dùng |
| 15 | `BannerActionType` | `RESTAURANT`, `CUISINE`, `VOUCHER`, `EXTERNAL_URL`, `NONE` | Hành động điều hướng khi nhấn vào Banner |
| 16 | `NotificationType` | `ORDER_STATUS`, `PROMOTION`, `SYSTEM`, `CHAT`, `SUPPORT` | Phân loại thông báo in-app |
| 17 | `SupportTicketCategory` | `ORDER_ISSUE`, `PAYMENT_REFUND`, `ACCOUNT_ISSUE`, `RESTAURANT_PARTNER`, `DRIVER_PARTNER`, `TECHNICAL_BUG`, `OTHER` | Phân loại chủ đề phiếu hỗ trợ |
| 18 | `SupportTicketStatus` | `OPEN`, `IN_PROGRESS`, `WAITING_USER`, `RESOLVED`, `CLOSED` | Trạng thái xử lý phiếu hỗ trợ |
| 19 | `SupportTicketPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | Mức độ ưu tiên của phiếu hỗ trợ |
| 20 | `SupportChatSessionStatus` | `ACTIVE`, `ESCALATED`, `CLOSED` | Trạng thái phiên chat với ZomBot |
| 21 | `SupportChatSenderType` | `USER`, `BOT`, `ADMIN` | Đối tượng gửi tin nhắn trong phiên chat hỗ trợ |

---

## 5. Chi tiết dữ liệu Seed và các trường hợp biên

File `backend/prisma/seed.ts` (1.136 dòng) khởi tạo bộ dữ liệu mẫu hoàn chỉnh tại khu vực **Thành phố Huế** (tọa độ trung tâm khoảng `16.4637, 107.5909`) để phục vụ kiểm thử và trình diễn (demo).

### 5.1. Số lượng bản ghi được tạo bởi `prisma/seed.ts`

| Loại dữ liệu | Số lượng | Chi tiết trong mã (`backend/prisma/seed.ts`) |
|---|---|---|
| Tài khoản người dùng (`User`) | **8 tài khoản** | 1 Admin, 2 Chủ quán, 2 Tài xế, 3 Khách hàng (`#L58-L148`) |
| Địa chỉ đã lưu (`Address`) | **4 địa chỉ** | Địa chỉ tại TP. Huế cho các tài khoản khách hàng (`#L152-L195`) |
| Hồ sơ tài xế (`Driver`) | **2 hồ sơ** | 1 tài xế `APPROVED` + `AVAILABLE`, 1 tài xế `PENDING` KYC (`#L198-L230`) |
| Danh mục ẩm thực (`CuisineCategory`) | **7 danh mục** | Bún/Phở, Cơm, Đồ uống, Ăn vặt, Lẩu & Nướng, Đồ chay, Bánh ngọt (`#L235-L265`) |
| Banner trang chủ (`Banner`) | **4 banner** | Khuyến mãi freeship, đại tiệc món Huế, quán mới lên sàn (`#L268-L310`) |
| Cấu hình Popup (`HomePromoConfig`) | **1 cấu hình** | Chiến dịch `WELCOME_ZOMZOM` giảm 30% đơn đầu (`#L312-L330`) |
| Quán ăn (`Restaurant`) | **18 quán ăn** | 14 quán hoạt động bình thường + **4 quán trường hợp biên** (`#L335-L610`) |
| Món ăn (`MenuItem`) & Tùy chọn | **44+ món ăn** | Đầy đủ `MenuCategory`, `MenuItemOptionGroup` (Size, Topping) và món hết hàng (`#L615-L780`) |
| Mã giảm giá (`Voucher`) | **6 voucher** | 4 voucher sàn (`PLATFORM`) + 2 voucher quán (`RESTAURANT`), gồm cả mã hết hạn & hết lượt (`#L785-L865`) |
| Đơn hàng mẫu (`Order`) | **15 đơn hàng** | Trải đều các trạng thái: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERING`, `DELIVERED`, `CANCELLED` (`#L870-L1020`) |
| Đánh giá (`Review`) | **30 đánh giá** | Kèm nhận xét tiếng Việt và phản hồi mẫu từ chủ quán (`#L1025-L1080`) |
| Từ khóa tìm kiếm (`SearchLog`) | **12 cụm từ** | Tạo dữ liệu cho mục "Xu hướng tìm kiếm" (`#L1082-L1100`) |
| Trung tâm trợ giúp (`HelpCategory` & `HelpArticle`) | **6 danh mục, 18 bài viết** | Tự động seed thêm khi khởi động `HelpService.onModuleInit` (`backend/src/help/help.service.ts#L28-L45`) |

### 5.2. Danh sách 8 tài khoản Demo (Dữ liệu thử nghiệm trong `seed.ts`)

Tất cả tài khoản demo trong `backend/prisma/seed.ts#L50` đều dùng chung mật khẩu thử nghiệm là **`Password123!`** (băm bằng Argon2id khi chạy seed):

| Vai trò | Email đăng nhập (Dữ liệu thử) | Họ tên hiển thị | Trạng thái đặc biệt | Vị trí trong `seed.ts` |
|---|---|---|---|---|
| `ADMIN` | `admin@fooddelivery.com` | Quản Trị Viên ZomZom | `ACTIVE` | `#L60-L69` |
| `RESTAURANT_OWNER` | `owner@fooddelivery.com` | Chủ Quán Cố Đô | Sở hữu các quán chính (Bún Bò Huế Cố Đô, ZomZom...) | `#L71-L80` |
| `RESTAURANT_OWNER` | `owner2@fooddelivery.com` | Chủ Quán Phố Huế | Sở hữu nhóm quán thứ 2 | `#L82-L91` |
| `DRIVER` | `driver@fooddelivery.com` | Tài Xế Nguyễn Văn A | `kycStatus: APPROVED`, `status: AVAILABLE` | `#L93-L102` |
| `DRIVER` | `driver2@fooddelivery.com` | Tài Xế Trần Văn B | `kycStatus: PENDING` (dùng để test luồng Admin duyệt KYC) | `#L104-L113` |
| `CUSTOMER` | `customer@fooddelivery.com` | Khách Hàng Lê Thị C | Tài khoản khách chính (có sẵn đơn hàng, địa chỉ, yêu thích) | `#L115-L124` |
| `CUSTOMER` | `customer2@fooddelivery.com` | Khách Hàng Phạm Văn D | Có sẵn 1 `RoleUpgradeRequest` trạng thái `PENDING` | `#L126-L135` |
| `CUSTOMER` | `blocked@fooddelivery.com` | Tài Khoản Bị Khóa | `status: BLOCKED` (dùng để test chặn đăng nhập/sử dụng) | `#L137-L146` |

### 5.3. Các trường hợp biên (Edge Cases) được thiết kế có chủ ý trong Seed

1. **Quán đang đóng cửa tạm thời**: Quán có `isOpen: false`, `approvalStatus: APPROVED` (`backend/prisma/seed.ts#L540`) — dùng để kiểm thử giao diện nhãn "Đóng cửa" và chặn đặt hàng.
2. **Quán mới đăng ký chờ Admin duyệt**: Quán có `approvalStatus: PENDING` (`backend/prisma/seed.ts#L560`) — không xuất hiện trên ứng dụng khách hàng nhưng hiển thị trong tab chờ duyệt của Admin.
3. **Quán bị từ chối / đình chỉ**: Quán có `approvalStatus: REJECTED` (`backend/prisma/seed.ts#L580`).
4. **Quán mới chưa có thực đơn (Empty Menu)**: Quán đã duyệt nhưng có `0` danh mục và `0` món ăn (`backend/prisma/seed.ts#L595`) — dùng để kiểm thử trạng thái rỗng (`EmptyState`) trên màn hình chi tiết quán.
5. **Món ăn tạm hết hàng**: Món ăn có `isAvailable: false` (`backend/prisma/seed.ts#L685`) — hiển thị mờ kèm nhãn "Hết hàng" và không cho thêm vào giỏ.
6. **Voucher hết hạn & Voucher hết lượt dùng**:
   - Mã `EXPIRED50`: có `expiresAt` trong quá khứ (`backend/prisma/seed.ts#L835`).
   - Mã `SOLDOUT30`: có `usageLimit: 10, usedCount: 10` (`backend/prisma/seed.ts#L850`).
7. **Tài xế chờ duyệt KYC**: Tài khoản `driver2@fooddelivery.com` có `kycStatus: PENDING` — khi bật trực tuyến hoặc nhận đơn sẽ bị chặn cho tới khi Admin duyệt.
8. **Tài khoản bị khóa**: Tài khoản `blocked@fooddelivery.com` có `status: BLOCKED` — bị `JwtStrategy` và `AuthService.login` từ chối truy cập.

