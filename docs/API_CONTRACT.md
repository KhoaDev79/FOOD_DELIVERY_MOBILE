# API Contract — Food Delivery Backend

Base URL: `http://<host>:3000/api/v1`

## Envelope

- Success: `{ "success": true, "data": <payload> }`
- Error: `{ "success": false, "statusCode": number, "message": string, "errors"?: string[], "path": string, "timestamp": string }`
- Auth header: `Authorization: Bearer <accessToken>` (mọi route trừ route đánh dấu **public**).
- Access token hết hạn → `401` → client gọi `/auth/refresh` (refresh token rotation: mỗi refresh token dùng 1 lần).

Paginated payload: `{ items: T[], page: number, limit: number, hasMore: boolean }`

## Enums

- `Role`: `CUSTOMER | RESTAURANT_OWNER | DRIVER | ADMIN`
- `OrderStatus`: `PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP → PICKED_UP → DELIVERED` (+ `CANCELLED` từ PENDING/CONFIRMED)
- `PaymentMethod`: `COD | VNPAY`
- `PaymentStatus`: `UNPAID | PAID | FAILED | REFUNDED`

Tiền tệ: số nguyên VND.

## Auth

| Method | Path | Body | Response `data` |
|---|---|---|---|
| POST | `/auth/register` (public) | `{ email, password(8-72), fullName, phone?, role? }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` (public) | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` (public) | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | – | 204 |

`user` = `{ id, email, phone, fullName, role, avatarUrl, isActive, createdAt, updatedAt }`
`phone` regex: `^(\+84|0)\d{9,10}$`

## Users (`/users/me`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/users/me` | – | `user` |
| PATCH | `/users/me` | `{ fullName?, phone?, avatarUrl? }` | `user` |
| PUT | `/users/me/push-token` | `{ expoPushToken: "ExponentPushToken[...]" }` | `{ ok: true }` |
| GET | `/users/me/addresses` | – | `Address[]` |
| POST | `/users/me/addresses` | `{ label, addressLine, latitude, longitude, isDefault? }` | `Address` |
| DELETE | `/users/me/addresses/:id` | – | 204 |

`Address` = `{ id, userId, label, addressLine, latitude, longitude, isDefault, createdAt }`

## Restaurants

| Method | Path | Notes |
|---|---|---|
| GET | `/restaurants/nearby?lat&lng&radiusKm=10&q&openOnly&page=1&limit=20` (public) | Paginated `NearbyRestaurant` |
| GET | `/restaurants/:id` (public) | `RestaurantDetail` |
| GET | `/restaurants/mine` | OWNER/ADMIN |
| POST | `/restaurants` | OWNER/ADMIN |
| PATCH | `/restaurants/:id` | OWNER/ADMIN |

`NearbyRestaurant` = `{ id, name, description, imageUrl, address, latitude, longitude, deliveryRadiusKm, isOpen, rating, distanceKm }`

`RestaurantDetail` = Restaurant fields + `categories: { id, name, sortOrder, menuItems: MenuItem[] }[]` + `uncategorizedItems: MenuItem[]`

`MenuItem` = `{ id, restaurantId, categoryId, name, description, price, imageUrl, isAvailable, isArchived }`

## Menus (OWNER/ADMIN)

- POST `/restaurants/:restaurantId/categories` `{ name, sortOrder? }`
- POST `/restaurants/:restaurantId/menu-items` `{ name, description?, price, categoryId?, imageUrl?, isAvailable? }`
- PATCH `/menu-items/:id`, DELETE `/menu-items/:id` (soft archive)

## Orders

| Method | Path | Role | Body / Query |
|---|---|---|---|
| POST | `/orders` | CUSTOMER | `{ restaurantId, items: [{ menuItemId, quantity(1-50), note? }], addressId? \| (deliveryAddress, deliveryLat, deliveryLng), paymentMethod: 'COD'\|'VNPAY', note? }` |
| GET | `/orders/my?status&page&limit` | CUSTOMER | Paginated `OrderSummary` |
| GET | `/orders/:id` | participant | `OrderDetail` |
| PATCH | `/orders/:id/status` | participant | `{ status }` (customer: chỉ `CANCELLED` khi `PENDING`) |
| GET | `/orders/available` | DRIVER | |
| GET | `/orders/deliveries` | DRIVER | |
| POST | `/orders/:id/accept` | DRIVER | |
| GET | `/orders/restaurant/:restaurantId` | OWNER/ADMIN | |

**Client KHÔNG gửi giá.** Server tra giá từ DB, tính `subtotal`, `deliveryFee` (theo khoảng cách Haversine), `total`.

`OrderSummary` = Order fields + `items: { name, quantity }[]` + `restaurant: { id, name, imageUrl }`

`OrderDetail` = `{ id, customerId, restaurantId, driverId, status, paymentMethod, paymentStatus, subtotal, deliveryFee, total, distanceKm, deliveryAddress, deliveryLat, deliveryLng, note, createdAt, updatedAt, items: { id, menuItemId, name, unitPrice, quantity, lineTotal, note }[], restaurant: { id, name, imageUrl, address, latitude, longitude, ownerId }, customer: { id, fullName, phone }, driver: { id, fullName, phone } | null, statusHistory: { id, status, changedBy, createdAt }[] }`

## Payments

| Method | Path | Notes |
|---|---|---|
| POST | `/payments/vnpay/:orderId/url` | CUSTOMER chủ đơn, đơn `VNPAY` + `UNPAID` → `{ paymentUrl }` |
| GET | `/payments/vnpay/ipn` (public) | VNPay server-to-server IPN (verify chữ ký HMAC-SHA512) |
| GET | `/payments/vnpay/return` (public) | Trình duyệt redirect về → server verify rồi redirect `MOBILE_PAYMENT_REDIRECT?orderId=..&status=success\|failed` (mặc định `fooddelivery://payment-result`) |

Luồng mobile VNPay: tạo đơn `paymentMethod=VNPAY` → gọi `/payments/vnpay/:id/url` → `WebBrowser.openAuthSessionAsync(paymentUrl, 'fooddelivery://payment-result')` → điều hướng sang Tracking; trạng thái `paymentStatus` cuối cùng lấy từ server (IPN là nguồn chân lý).

## Media (OWNER/ADMIN, hoặc user cho avatar)

- POST `/media/upload?folder=menu|restaurant|avatar` multipart field `file` (≤ 5MB, image/*) → `{ url, publicId, width, height }`

## Realtime (Socket.IO, cùng host, path mặc định `/socket.io`)

- Connect: `io(BASE_HOST, { auth: { token: accessToken }, transports: ['websocket'] })`
- Server tự join `user_<id>` (và `drivers` nếu DRIVER).
- Client emit `order:join { orderId }` (ack `{ ok }`), `order:leave { orderId }`.
- Server events: `order:created`, `order:status`, `order:driver_assigned`, `order:payment` → payload `{ id, status, paymentStatus, driverId, updatedAt }`
- `driver:location` → `{ orderId, lat, lng, at }` ; `order:available` (drivers room).

