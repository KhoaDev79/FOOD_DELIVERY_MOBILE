# Prompt: Nâng cấp chức năng ZomZom V4 — Sửa toàn bộ lỗi & đưa nghiệp vụ về chuẩn thực tế (COD)

> **Dành cho:** AI Coding Agent (Claude Code, Cursor, Copilot Workspace…) làm việc trực tiếp trên repo `food-delivery-system`, nhánh `redesign/nativewind-ui`.
> **Tài liệu kế thừa:** `docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md` (báo cáo khảo sát, có trích dẫn file:dòng) và `docs/nangcapchucnangV3.md`. Prompt V4 **thay thế** V3 về phạm vi: bao trùm 5 lỗ hổng của V3 **và** mọi lỗi/khoảng trống khác trong báo cáo khảo sát.
> **Không sửa** các file prompt/báo cáo cũ trong `docs/`. Chỉ tạo mới `docs/BAO_CAO_NANG_CAP_V4.md` khi xong.

---

## 0. Vai trò và mục tiêu

Bạn là **Senior Full-stack Engineer** (NestJS + Prisma + PostgreSQL, Expo/React Native + NativeWind). Mục tiêu:

1. Vá các lỗ hổng bảo mật và phân quyền.
2. Đưa vòng đời đơn hàng, giao nhận, tiền mặt (COD), đánh giá, quản trị về **đúng nghiệp vụ của một app giao đồ ăn thực tế**.
3. **Gỡ mọi dữ liệu cứng và giả lập** khỏi app: không còn tin nhắn mẫu, phản hồi tự động, số điện thoại mẫu, voucher viết cứng, đồng hồ cuộc gọi giả, công thức phí trùng lặp ở client.
4. Mọi con số nghiệp vụ (phí, hoa hồng, hạn mức, thời gian chờ, bán kính) phải **đọc từ cấu hình** (`.env` → `backend/src/config/configuration.ts`). Không được rải hằng số trong code.

---

## 1. Quy tắc bắt buộc (vi phạm = làm lại)

### 1.1. Dữ liệu và migration
- Database dev chạy trong Docker: container `food_delivery_db` (Postgres 16), cổng `5433`, DB `food_delivery`, user `food`.
- **Trước khi đổi schema**, chạy sao lưu và in câu lệnh ra cho người dùng:
  ```bash
  docker exec food_delivery_db pg_dump -U food -d food_delivery -Fc > backup_truoc_v4.dump
  ```
- Lệnh migration duy nhất được phép: `npx prisma migrate dev --name <ten>` (trong `backend/`).
- **Cấm tuyệt đối:** `prisma migrate reset`, `prisma db push`, `--force-reset`, xoá hay sửa thư mục migration đã có.
- Mọi cột mới trên bảng có dữ liệu phải **nullable hoặc có default**. Nếu cần backfill, viết SQL backfill **trong chính file migration** (sau khi `migrate dev --create-only`, chỉnh SQL rồi mới `migrate dev`).
- Cập nhật `backend/prisma/seed.ts` cho khớp schema mới. Seed là nơi **duy nhất** được phép có dữ liệu mẫu.

### 1.2. Git
- Trước khi sửa code: commit riêng các file đang chưa được theo dõi mà code đã phụ thuộc (khoảng 40 file: 4 thư mục migration `20261030*`, `backend/src/modules/drivers/`, `backend/src/common/utils/{opening-hours,vietnamese,vietnamese-plate.util,username.util}.ts`, `backend/src/modules/orders/driver-stats.ts`, `backend/src/modules/restaurants/restaurant-stats.ts`, `backend/src/modules/menus/menu-discount.ts`, `backend/src/modules/users/{favorites.service,role-requests.*}.ts`, `mobile/src/api/drivers.ts`, `mobile/src/screens/driver/*`, `mobile/src/components/modules/admin/`…). Kiểm tra bằng `git status --short`.
- **Không commit:** `.agents/`, `.aider-desk/`, `skills-lock.json`, `backend/public/uploads/` (thêm vào `.gitignore`), `*.dump`.
- Mỗi Sprint (mục 4) là **một commit** riêng. **Không push**, không force, không đổi nhánh.

### 1.3. Backend phòng thủ
- Không tin bất kỳ giá trị nào client tính: giá, phí ship, tổng tiền, vai trò, toạ độ quán, thời điểm.
- Mọi DTO dùng `class-validator`. Pipe toàn cục đã bật `whitelist` + `forbidNonWhitelisted` (`backend/src/main.ts`), nên trường thừa sẽ bị từ chối.
- Lỗi trả **tiếng Việt rõ nghĩa**, đúng mã: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền, 404 không tìm thấy (hoặc không được xem), 409 xung đột trạng thái/giá, 429 quá tần suất.
- Thay đổi trạng thái đơn luôn đi qua `order-state-machine.ts` và dùng khoá lạc quan (`updateMany WHERE status = <trạng thái vừa đọc>`), như `orders.service.ts › updateStatus` đang làm.
- Phát socket và push **sau khi transaction commit**, không phát bên trong transaction.
- Mọi thao tác nhạy cảm của admin phải ghi `AuditLog` **trong cùng transaction**.

### 1.4. Mobile
- Dùng component có sẵn trong `mobile/src/components/ui` (`Button`, `Text`, `TopBar`, `ListRow`, `Chip`, `Overlays`, `States`…). Không thêm thư viện UI mới.
- Vùng chạm tối thiểu 44pt. Không dùng emoji trong chuỗi nghiệp vụ (kể cả tiêu đề push ở backend: bỏ `🛎️`, `🛵`).
- Mỗi màn hình chỉ một tầng header. Không có nút nổi (FAB) đè lên nội dung.
- Lưu ý bộ nhớ dự án: trên iOS, `Animated.View` với **mảng style** bị rơi phần style tĩnh. Mỗi `Animated.View` chỉ dùng một style động, phần tĩnh để ở view bọc ngoài hoặc `className`.
- Mọi số tiền hiển thị lấy từ API. Client không tự tính phí ship hay tổng tiền.

### 1.5. Cấm dữ liệu cứng / giả
Sau khi xong, các lệnh tìm sau trong `mobile/src` phải **không còn kết quả** (trừ file test `*.spec.ts`):
```bash
grep -rn "INITIAL_MESSAGES\|AVAILABLE_VOUCHERS\|0908 123 456\|ord-call\|Tự động phản hồi\|setTimeout(() => {\s*const replyMsg" mobile/src
grep -rn "DELIVERY_FEE_CONFIG\|calculateDeliveryFee" mobile/src --include=*.tsx
```

---

## 2. Quy trình làm việc

1. **Xác minh:** đọc `docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md`. Mở từng file sẽ sửa để xác nhận số dòng còn đúng; nếu code đã khác báo cáo, theo code hiện tại.
2. **Trình bày kế hoạch ngắn:** danh sách file sẽ sửa/tạo, endpoint mới, cột/bảng mới, cách xử lý dữ liệu cũ, biến `.env` mới.
3. **Chờ người dùng trả lời "Đồng ý"** rồi mới chạy sao lưu, commit và sửa code.
4. Làm **tuần tự Sprint 1 → 5** (mục 4). Hết mỗi Sprint: chạy kiểm tra (mục 6), sửa đến khi xanh, commit, báo tiến độ một dòng.
5. Gặp điểm mơ hồ không quyết được: chọn phương án an toàn, đúng nghiệp vụ hơn, ghi lại trong báo cáo cuối. **Không** tạo dữ liệu giả để "cho chạy được".

---

## 3. Đặc tả nâng cấp chi tiết

### 3.1. Cấu hình mới (`.env.example` + `configuration.ts`)

Thêm nhóm cấu hình `business` (đọc bằng `parseInt`/`parseFloat`, có default) và validate không âm trong `validateEnv`:

| Biến | Default | Ý nghĩa |
|---|---|---|
| `DELIVERY_BASE_FEE` | 15000 | (đã có) phí cơ bản |
| `DELIVERY_FEE_PER_KM` | 5000 | (đã có) phí mỗi km vượt mức |
| `DELIVERY_FREE_KM` | 2 | (đã có) số km tính trong phí cơ bản |
| `DELIVERY_PEAK_MULTIPLIER` | 1.2 | hệ số giờ cao điểm |
| `DELIVERY_PEAK_WINDOWS` | `11:00-13:00,17:30-19:30` | khung giờ cao điểm (giờ VN) |
| `ROAD_DISTANCE_FALLBACK_FACTOR` | 1.3 | hệ số Haversine khi Goong lỗi |
| `QUOTE_TTL_MINUTES` | 10 | hạn báo giá |
| `PLATFORM_COMMISSION_RATE` | 0.2 | hoa hồng nền tảng trên phí ship |
| `DRIVER_DEBT_LIMIT` | 1000000 | hạn mức nợ COD của tài xế |
| `DRIVER_SEARCH_RADIUS_KM` | 5 | bán kính tài xế thấy đơn |
| `DRIVER_LOCATION_STALE_MINUTES` | 5 | quá hạn thì coi vị trí tài xế không còn tin cậy |
| `DRIVER_OFFLINE_AFTER_MINUTES` | 15 | không có vị trí quá lâu thì tự chuyển ngoại tuyến |
| `MAX_ACTIVE_DELIVERIES` | 2 | (thay hằng số trong `orders.service.ts`) |
| `ORDER_PENDING_TIMEOUT_MINUTES` | 5 | quán không nhận → tự huỷ |
| `ORDER_STALLED_PICKUP_MINUTES` | 10 | sẵn sàng mà chưa có tài xế → cảnh báo |
| `FAILED_DELIVERY_MIN_WAIT_MINUTES` | 10 | thời gian chờ tối thiểu tại điểm giao |
| `FAILED_DELIVERY_MIN_CALLS` | 3 | số lần gọi tối thiểu |
| `ARRIVAL_MAX_DISTANCE_M` | 200 | khoảng cách tối đa để xác nhận "đã đến" |
| `REVIEW_WINDOW_DAYS` | 7 | hạn đánh giá sau khi giao |
| `AUTH_ACTIVE_CACHE_SECONDS` | 30 | cache kiểm tra tài khoản bị khoá |

Mobile **không** sao chép các giá trị này. Nếu cần hiển thị (ví dụ bán kính), lấy qua `GET /config/public` (Public, chỉ trả các giá trị không nhạy cảm).

### 3.2. Thay đổi schema Prisma (một migration `v4_business_upgrade`)

```prisma
enum RestaurantStatus { PENDING_APPROVAL  ACTIVE  SUSPENDED }

enum OrderStatus { PENDING CONFIRMED PREPARING READY_FOR_PICKUP PICKED_UP DELIVERED DELIVERY_FAILED CANCELLED }

enum CancelReason {
  CUSTOMER_CHANGED_MIND
  RESTAURANT_TIMEOUT        // quán không nhận trong ORDER_PENDING_TIMEOUT_MINUTES
  RESTAURANT_OUT_OF_STOCK
  RESTAURANT_CLOSED
  RESTAURANT_OTHER
  ADMIN_INTERVENTION
}

enum FailedDeliveryReason { CUSTOMER_UNREACHABLE  CUSTOMER_REFUSED  WRONG_ADDRESS  UNSAFE_LOCATION }

enum DistanceSource { ROAD  ESTIMATED }

enum LedgerEntryType { COD_COLLECTED  SETTLEMENT  ADJUSTMENT }
```

| Bảng | Thay đổi | Dữ liệu cũ |
|---|---|---|
| `Restaurant` | `status RestaurantStatus @default(PENDING_APPROVAL)`, `approvedAt DateTime?`, `approvedById String? @db.Uuid`, `suspendReason String?`, index `(status)` | SQL backfill: mọi quán đang có → `ACTIVE`, `approvedAt = createdAt` |
| `Order` | `cancelReason CancelReason?`, `cancelNote String?`, `cancelledById String? @db.Uuid`, `failedReason FailedDeliveryReason?`, `arrivedAt DateTime?`, `stalledAt DateTime?`, `distanceSource DistanceSource @default(ESTIMATED)`, `peakSurcharge Int @default(0)`, `platformCommission Int @default(0)`, `driverEarning Int @default(0)` | Đơn cũ: `distanceSource = ESTIMATED`; với đơn `DELIVERED` backfill `platformCommission = round(deliveryFee * rate)`, `driverEarning = deliveryFee - platformCommission` (dùng rate 0.2 trong SQL, ghi chú trong migration) |
| `DeliveryContactAttempt` (mới) | `id`, `orderId`, `driverId`, `createdAt`; index `(orderId, createdAt)` | — |
| `DriverLedger` (mới) | `id`, `driverId` (FK User), `orderId String? @unique` (chỉ cho `COD_COLLECTED`), `type LedgerEntryType`, `amount Int` (dương = tài xế nợ thêm, âm = đã nộp/giảm nợ), `balanceAfter Int`, `note String?`, `createdById String? @db.Uuid`, `createdAt`; index `(driverId, createdAt)` | Không backfill đơn cũ (ghi rõ trong báo cáo) |
| `DriverProfile` | `codBalance Int @default(0)` (số dư nợ hiện tại, cập nhật cùng transaction với ledger) | 0 |
| `Review` | `orderId String? @unique @db.Uuid` (FK Order, `onDelete: SetNull`), `driverId String? @db.Uuid`, `driverRating Int?`, `driverComment String?`, `ownerReply String?`, `ownerRepliedAt DateTime?`, `isHidden Boolean @default(false)`; đổi FK `customerId` sang `onDelete: SetNull` + nullable để xoá user không làm mất đánh giá | 30 đánh giá seed giữ `orderId = null` |
| `Restaurant` | thêm `ratingCount Int @default(0)` | Backfill bằng `COUNT(*)` từ `reviews` |
| `AuditLog` | đổi `targetId` từ `@db.Uuid` sang `String` | Ép kiểu `::text` trong migration |

Ràng buộc kiểm tra (thêm bằng SQL trong migration): `reviews.rating BETWEEN 1 AND 5`, `reviews."driverRating" BETWEEN 1 AND 5`.

**Không** xoá enum `PaymentMethod.VNPAY`, bảng `payment_transactions` hay module `payments` (giữ cho dữ liệu cũ). Chỉ ngừng cho dùng (mục 3.5).

---

### 3.3. Trụ cột A — Bảo mật, phân quyền, kiểm duyệt quán

**A1. Đóng lỗ hổng đăng ký**
- `backend/src/modules/auth/dto/auth.dto.ts`: xoá trường `role` và `SELF_REGISTER_ROLES` khỏi `RegisterDto`. `auth.service.ts › register` luôn tạo `CUSTOMER`.
- Client gửi `role` sẽ nhận 400 (nhờ `forbidNonWhitelisted`). Viết unit test cho trường hợp này.
- Muốn làm chủ quán hoặc tài xế: dùng luồng `RoleUpgradeRequest` có sẵn (`users/role-requests.*`, màn `RoleUpgradeRequestScreen`).

**A2. Kiểm duyệt quán**
- `restaurants.controller.ts › create`: chủ quán tạo → `PENDING_APPROVAL`. Admin tạo (kể cả `admin.service.ts › createRestaurant`) → `ACTIVE`, `approvedAt = now`.
- Chủ quán sửa **tên, địa chỉ hoặc toạ độ** của quán `ACTIVE` → quán quay về `PENDING_APPROVAL`, ghi audit (chống đổi địa chỉ để lách vùng giao). Sửa mô tả, ảnh, giờ, công tắc `isOpen` không cần duyệt lại.
- Mọi truy vấn phía khách (`findNearby`, `findNearbyDishes`, `findOneWithMenu`, lúc đặt đơn, lúc báo giá) chỉ nhận `status = ACTIVE`. Quán không `ACTIVE`: trang chi tiết trả 404 cho khách, vẫn xem được cho chủ quán và admin.
- `isAcceptingOrders(r)` (`common/utils/opening-hours.ts`) đổi thành: `status === ACTIVE && isOpen && trong giờ`.
- Chủ quán xoá quán (`restaurants.service.ts › delete`): áp đúng quy tắc của admin, quán đã có đơn thì 409 "hãy tạm đóng quán". Không còn ném lỗi khoá ngoại thô.
- API admin mới:
  - `PATCH /admin/restaurants/:id/approve` → `ACTIVE`, ghi `approvedAt`, `approvedById`, audit `RESTAURANT_APPROVE`, push cho chủ quán.
  - `PATCH /admin/restaurants/:id/reject` body `{ reason }` (bắt buộc) → giữ `PENDING_APPROVAL`, lưu `suspendReason`, audit `RESTAURANT_REJECT`, push.
  - `PATCH /admin/restaurants/:id/status` body `{ status: 'ACTIVE' | 'SUSPENDED', reason? }` (bắt buộc lý do khi `SUSPENDED`), audit `RESTAURANT_SUSPEND/RESUME`. Thay cho việc `toggle-open` đang lạm dụng cột `isOpen`. Giữ endpoint `toggle-open` nhưng chuyển sang dùng `status`, ghi chú "deprecated".
  - `GET /admin/restaurants?status=PENDING_APPROVAL` để lọc quán chờ duyệt.
- `PATCH /admin/restaurants/:id/assign-owner` **đã có** (`admin.service.ts › assignRestaurantOwner`). Xác minh: người được gán đang `CUSTOMER` thì tự lên `RESTAURANT_OWNER` và bị thu hồi refresh token; người đang `DRIVER` hoặc `ADMIN` thì 409 với thông báo rõ; tài khoản bị khoá thì 400. Bổ sung test.
- Mobile chủ quán (`OwnerRestaurantScreen.tsx`): hiển thị trạng thái duyệt, lý do từ chối/tạm ngưng; quán `PENDING_APPROVAL` vẫn sửa được menu nhưng có thông báo "Quán chưa hiển thị với khách".
- Mobile admin (`AdminRestaurantsScreen.tsx` + `RestaurantDetailSheet.tsx`): thêm bộ lọc "Chờ duyệt", nút Duyệt / Từ chối (bắt buộc lý do) / Tạm ngưng / Mở lại. Dashboard (`AdminDashboardScreen.tsx`) hiện số quán chờ duyệt lấy từ `GET /admin/stats`.

**A3. Khoá tài khoản có hiệu lực ngay**
- Tạo `AuthStateService` (module auth, export dùng chung): `isActive(userId)` đọc DB, cache trong bộ nhớ theo `AUTH_ACTIVE_CACHE_SECONDS`, và hàm `invalidate(userId)`.
- `JwtStrategy.validate` gọi `isActive`; bị khoá → 401 "Tài khoản đã bị khoá". Đồng thời so `role` trong token với `role` trong DB (cache cùng lúc); khác nhau → 401 "Vai trò đã thay đổi, vui lòng đăng nhập lại".
- `admin.service.ts › toggleUserActive`, `changeUserRole`, `assignRestaurantOwner`, `reviewRoleRequest` gọi `invalidate` sau commit, đồng thời ngắt mọi socket của user đó (`server.in('user_<id>').disconnectSockets(true)`).
- `orders.gateway.ts › handleConnection`: kiểm tra `isActive` trước khi cho vào phòng.
- Mobile `api/client.ts`: nhận 401 có thông báo khoá → đăng xuất, hiện thông báo; không lặp refresh vô hạn.

**A4. Audit log đầy đủ**
Ghi `AuditLog` (cùng transaction) cho: tạo/sửa/xoá quán (admin và chủ quán đổi tên/địa chỉ/toạ độ), duyệt/từ chối/tạm ngưng quán, xoá món bởi admin, duyệt/từ chối/tạm khoá tài xế (`drivers.service.ts › adminVerifyDriver`), admin đổi trạng thái hoặc huỷ đơn, ghi nhận tài xế nộp tiền, điều chỉnh công nợ, admin ẩn đánh giá. `targetType` mở rộng: `USER | RESTAURANT | ORDER | DRIVER | REVIEW | MENU_ITEM`.

**A5. Khác**
- `admin.service.ts › createRestaurant`: mật khẩu tạm sinh bằng `crypto.randomBytes` (≥ 12 ký tự, có chữ hoa, thường, số, ký tự đặc biệt), không dùng `Math.random`.
- `@WebSocketGateway({ cors: { origin: '*' } })` và `enableCors({ origin: true })`: đọc `CORS_ORIGINS` từ config (giữ `*` cho dev nếu biến là `*`).

---

### 3.4. Trụ cột B — Bản đồ, điểm giao hàng thống nhất, báo giá tập trung

**B1. Adapter khoảng cách đường bộ**
- `backend/src/modules/maps/maps.service.ts`: thêm `getRoadDistance(origin, dest): Promise<{ distanceKm, durationMinutes, source: 'ROAD' | 'ESTIMATED' }>`.
  - Khoá cache: toạ độ hai đầu làm tròn 3 chữ số thập phân, TTL 24 giờ.
  - Gọi Goong DistanceMatrix (`providers/goong-map.provider.ts`) với `GOONG_API_KEY`, `vehicle=bike`. Thành công → `ROAD`.
  - Goong lỗi, hết quota, hoặc không có key → Haversine × `ROAD_DISTANCE_FALLBACK_FACTOR`, `ESTIMATED`, ghi log cảnh báo (không lộ key).
  - Cache cả kết quả `ESTIMATED` nhưng chỉ 5 phút, để Goong hồi phục thì dùng lại số đường bộ.
- Đưa cache và giới hạn tốc độ sang một lớp dùng chung có giới hạn kích thước (LRU, ví dụ 10.000 khoá), tránh `Map` phình vô hạn như `SimpleCache` hiện tại.
- `providers/fallback-map.provider.ts`: các lời gọi Nominatim phải qua `RateLimiter` (≥ 1,1 giây/lần) và có header `User-Agent` hợp lệ.
- Thống nhất hệ số: `nominatim-map.provider.ts` và `fallback-map.provider.ts` dùng `ROAD_DISTANCE_FALLBACK_FACTOR` thay cho `1.35` viết cứng.
- Xoá `estimateDelivery()` không dùng trong `common/utils/geo.util.ts`, hoặc thay bằng hàm dùng thật trong báo giá.
- Đọc khung giờ cao điểm và hệ số từ config (`DELIVERY_PEAK_*`), bỏ giờ viết cứng trong `isPeakHour`.

**B2. Quy tắc khoảng cách**
- **Vùng giao (được/không được giao):** Haversine (rẻ, dùng cho danh sách quán). Giữ như hiện tại.
- **Phí ship:** khoảng cách **đường bộ** từ adapter B1, chỉ tính lúc báo giá và lúc đặt đơn.
- Danh sách quán và chi tiết quán: hiển thị khoảng cách kèm chữ "khoảng" và **phí ship ước tính "từ X đ"** do backend trả (`estimatedDeliveryFee` tính bằng Haversine × hệ số, không gọi Goong). Không tính ở client.

**B3. Báo giá — `POST /orders/quote`** (Roles: CUSTOMER)
- Body giống `CreateOrderDto` nhưng không có `quoteToken`/`note`: `restaurantId`, `items[]` (menuItemId, quantity, sizeId, toppingIds, level), `addressId` (**bắt buộc**, bỏ nhánh gửi toạ độ thô — địa chỉ phải lưu trong sổ địa chỉ của khách).
- Xử lý (tái dùng logic của `orders.service.ts › create`, tách thành `OrderPricingService` dùng chung cho quote và create):
  1. Quán `ACTIVE`, đang nhận đơn, trong giờ; địa chỉ thuộc khách; trong bán kính giao (Haversine).
  2. Món thuộc quán, `isAvailable`, chưa `isArchived`; giá dòng tính bằng `priceOrderLine`.
  3. Khoảng cách đường bộ (B1) → `baseDeliveryFee = base + max(0, km − freeKm) × perKm`, `peakSurcharge = (multiplier − 1) × baseDeliveryFee` nếu cao điểm, `deliveryFee = baseDeliveryFee + peakSurcharge`. **Mọi khoản phí làm tròn lên 1.000đ**.
  4. `total = subtotal + deliveryFee` (chưa có khuyến mãi: hệ thống không có voucher, xem 3.8).
- Trả về:
  ```json
  {
    "quoteToken": "<HMAC>",
    "expiresAt": "ISO",
    "restaurant": { "id": "...", "name": "..." },
    "address": { "id": "...", "addressLine": "..." },
    "lines": [{ "menuItemId": "...", "name": "...", "unitPrice": 0, "quantity": 0, "lineTotal": 0, "options": {} }],
    "subtotal": 0,
    "distanceKm": 0,
    "distanceSource": "ROAD",
    "estimatedMinutes": { "min": 0, "max": 0 },
    "baseDeliveryFee": 0,
    "peakSurcharge": 0,
    "deliveryFee": 0,
    "total": 0,
    "paymentMethod": "COD"
  }
  ```
- `quoteToken`: HMAC-SHA256 (secret riêng `QUOTE_SECRET`, ≥ 32 ký tự, thêm vào `validateEnv`) trên chuỗi chuẩn hoá gồm: customerId, restaurantId, addressId, danh sách dòng đã sắp xếp (id|size|toppings|level|qty), subtotal, deliveryFee, total, expiresAt. Không cần bảng DB.

**B4. Đặt đơn — `POST /orders`**
- Body: các trường như quote + `quoteToken` (bắt buộc) + `note?`. Bỏ `paymentMethod` khỏi DTO (luôn COD), bỏ `deliveryAddress/deliveryLat/deliveryLng`.
- Kiểm chữ ký token và hạn. Sau đó **tính lại toàn bộ** như quote trong transaction.
  - Token sai chữ ký hoặc khác giỏ hàng → 400.
  - Token hết hạn **hoặc** số tiền tính lại khác số trong token → **409** `{ message: 'Giá hoặc phí giao hàng đã thay đổi, vui lòng xác nhận lại', code: 'QUOTE_CHANGED', quote: <báo giá mới đầy đủ> }`.
- Lưu vào đơn: `distanceKm` (đường bộ), `distanceSource`, `deliveryFee`, `peakSurcharge`, `platformCommission = ceil1000(deliveryFee × PLATFORM_COMMISSION_RATE)`, `driverEarning = deliveryFee − platformCommission`.
- Chống đặt trùng: header `Idempotency-Key` (UUID do client sinh mỗi lần bấm "Đặt đơn"). Cùng khách + cùng key trong 10 phút → trả lại đơn đã tạo, không tạo đơn mới (lưu khoá ở bảng nhỏ `OrderIdempotency` hoặc cột `idempotencyKey` unique theo `(customerId, idempotencyKey)` trên `Order`).

**B5. Mobile — một nguồn địa chỉ giao hàng**
- `store/useDeliveryAddressStore.ts › resolveActiveDeliveryAddress` là nguồn duy nhất cho toạ độ dùng ở: `HomeScreen.tsx` (dòng "Giao đến…"), `SearchScreen.tsx`, `RestaurantDetailScreen.tsx`, `CheckoutScreen.tsx`. Thay mọi chỗ đang dùng trực tiếp `useLocation()` để lọc quán.
- Chưa đăng nhập hoặc chưa có địa chỉ: dùng GPS để **xem** quán; khi checkout bắt buộc chọn/tạo địa chỉ đã lưu (mở `AddressManagement`/`AddressPicker`).
- Bỏ toạ độ mặc định TP.HCM (`DEFAULT_COORDS`) làm vị trí giả: không có GPS và không có địa chỉ → hiện trạng thái trống "Chọn địa chỉ giao hàng để xem quán quanh bạn", không hiển thị quán theo vị trí bịa.
- `CheckoutScreen.tsx`:
  - Hiển thị địa chỉ đang chọn, cho **đổi địa chỉ** ngay tại màn (sheet danh sách địa chỉ đã lưu).
  - Gọi `POST /orders/quote` mỗi khi giỏ hàng hoặc địa chỉ đổi (debounce 400 ms). Hiển thị đúng các khoản từ quote: tiền món, phí giao hàng, phụ phí cao điểm (nếu > 0), tổng tiền mặt, nguồn khoảng cách ("ước tính" khi `ESTIMATED`), thời gian dự kiến.
  - Tự gọi lại quote khi còn < 1 phút trước `expiresAt`.
  - Nhận 409 `QUOTE_CHANGED`: hiển thị hộp thoại so sánh tổng cũ/mới, khách bấm "Đồng ý" mới đặt lại bằng token mới.
  - Nút đặt đơn bị khoá khi đang lấy quote hoặc quote lỗi; hiển thị lỗi tiếng Việt từ server (ngoài vùng giao, quán đóng, món hết — đánh dấu món hết trong danh sách và cho xoá khỏi giỏ).
- Xoá logic tính phí ở `mobile/src/utils/fee.ts` (`calculateDeliveryFee`, `DELIVERY_FEE_CONFIG`, `isPeakHour`) và test tương ứng. Giữ hàm định dạng nếu còn dùng. Cập nhật mọi nơi import.
- `OrderTrackingScreen.tsx`: thời gian dự kiến lấy từ đơn (lưu `estimatedMinutes` khi tạo đơn, thêm cột `estimatedDeliveryAt DateTime?` vào `Order`), không tự ước tính.

---

### 3.5. Trụ cột C — COD 100%, công nợ tài xế, giao thất bại, máy trạng thái

**C1. Chỉ COD**
- `CreateOrderDto`: bỏ `paymentMethod`, server luôn ghi `COD`.
- `orders.service.ts`: bỏ điều kiện "VNPay chưa PAID thì không được CONFIRMED" và bộ lọc `VISIBLE_TO_MERCHANT` (thay bằng điều kiện không lọc; đơn VNPay cũ vẫn hiển thị bình thường cho lịch sử). Thống kê quán (`restaurants.service.ts › getStats`) cũng bỏ lọc VNPay.
- `PaymentsController`: `POST /payments/vnpay/:orderId/url` trả 400 "Thanh toán trực tuyến tạm ngừng". IPN/Return giữ nguyên để không làm hỏng giao dịch cũ.
- Mobile: `CheckoutScreen.tsx` bỏ lựa chọn VNPay và `expo-web-browser`; hiển thị cố định "Thanh toán tiền mặt khi nhận hàng". `mobile/App.tsx`: bỏ ánh xạ deep link `payment-result → Checkout`, giữ `order/:orderId → OrderTracking`. `mobile/src/api/payments.ts` chỉ còn nếu nơi khác dùng, ngược lại xoá.

**C2. Máy trạng thái mới** (`order-state-machine.ts` + test)

```
PENDING          → CONFIRMED (OWNER) | CANCELLED (CUSTOMER, OWNER, ADMIN, SYSTEM)
CONFIRMED        → PREPARING (OWNER) | CANCELLED (OWNER, ADMIN)
PREPARING        → READY_FOR_PICKUP (OWNER) | CANCELLED (OWNER chỉ với RESTAURANT_OUT_OF_STOCK, ADMIN)
READY_FOR_PICKUP → PICKED_UP (DRIVER đã nhận đơn) | CANCELLED (ADMIN)
PICKED_UP        → DELIVERED (DRIVER) | DELIVERY_FAILED (DRIVER, đủ điều kiện C5) | CANCELLED (ADMIN)
DELIVERED, DELIVERY_FAILED, CANCELLED → (kết thúc)
```
- Thêm actor `SYSTEM` (dùng cho cron), `changedBy = null` trong lịch sử.
- `PATCH /orders/:id/status` nhận body `{ status, cancelReason?, cancelNote? }`. Chuyển sang `CANCELLED` bắt buộc `cancelReason` hợp lệ với actor (khách chỉ `CUSTOMER_CHANGED_MIND`; chủ quán chỉ các lý do `RESTAURANT_*` trừ `RESTAURANT_TIMEOUT`; admin `ADMIN_INTERVENTION` + `cancelNote` bắt buộc). Lưu `cancelledById`.
- Huỷ đơn đã có tài xế: push và socket cho **tài xế** ("Đơn #xxxx đã bị huỷ: <lý do>"), không chỉ cho khách.
- Chủ quán nhận đơn: push cho khách (đã có). Đơn mới: push cho chủ quán **không emoji**.
- Push cho tài xế khi có đơn mới trong bán kính (C4) và khi đơn đã nhận bị huỷ.

**C3. Tài xế trả đơn**
- `POST /orders/:id/release` (DRIVER đang giữ đơn, chỉ khi trạng thái `CONFIRMED`/`PREPARING`/`READY_FOR_PICKUP`) body `{ reason }` (bắt buộc, ≤ 200 ký tự): gỡ `driverId`, ghi lịch sử, phát lại `order:available` cho tài xế trong bán kính, thông báo khách "Đang tìm tài xế khác". Đếm số lần trả đơn trong ngày (`OrderStatusHistory` hoặc audit); quá 3 lần/ngày → 409 "Bạn đã trả quá nhiều đơn hôm nay, liên hệ hỗ trợ".

**C4. Công nợ COD (`DriverLedger`)**
- Khi đơn COD chuyển `DELIVERED` (trong **cùng transaction** với `updateStatus`):
  - Tài xế đã thu `total` tiền mặt của khách. Tài xế được giữ `driverEarning`. Nợ nền tảng = `total − driverEarning` = `subtotal + platformCommission`.
  - Ghi `DriverLedger { type: COD_COLLECTED, orderId, amount: subtotal + platformCommission, balanceAfter }` và tăng `DriverProfile.codBalance`. `orderId` unique nên không ghi trùng.
- `assertDriverCanAccept` (`orders.service.ts`): thêm điều kiện `codBalance + (subtotal + platformCommission của đơn định nhận) ≤ DRIVER_DEBT_LIMIT`; vượt → 403 "Công nợ tiền mặt đã chạm hạn mức <x>đ. Vui lòng nộp tiền để tiếp tục nhận đơn."
- API tài xế:
  - `GET /drivers/me/ledger?page&limit` → `{ balance, limit, items[] }`.
  - `GET /orders/driver/stats`: `earnings` = tổng `driverEarning` (không còn là 100% phí ship); thống kê theo **thời điểm giao** (`OrderStatusHistory` DELIVERED), không theo `createdAt` (sửa `driver-stats.ts` + test).
- API admin:
  - `GET /admin/drivers/ledger?minBalance` → danh sách tài xế kèm `codBalance`, sắp giảm dần.
  - `GET /admin/drivers/:userId/ledger`.
  - `POST /admin/drivers/:userId/settlements` body `{ amount (>0, ≤ codBalance), note }` → ghi `SETTLEMENT` với `amount` âm, giảm `codBalance`, audit `DRIVER_SETTLEMENT`.
  - `POST /admin/drivers/:userId/adjustments` body `{ amount (±), note bắt buộc }` → `ADJUSTMENT`, audit.
  - Tất cả ghi ledger dùng `SELECT ... FOR UPDATE` trên `driver_profiles` (hoặc `updateMany` có điều kiện) để `balanceAfter` không sai khi chạy đồng thời.
- Mobile tài xế: màn mới `DriverWalletScreen` (stack trong `DriverTabNavigator`) — số dư nợ, hạn mức, thanh tiến độ, lịch sử. `DriverAvailableOrdersScreen` hiện cảnh báo khi ≥ 80% hạn mức và khoá nút nhận khi vượt.
- Mobile admin: trong tab Người dùng / sheet tài xế, thêm mục "Công nợ COD" với nút "Ghi nhận nộp tiền" và "Điều chỉnh".

**C5. Giao thất bại**
- `POST /orders/:id/arrived` (DRIVER giữ đơn, trạng thái `PICKED_UP`) body `{ lat, lng }`: kiểm tra khoảng cách tới `deliveryLat/Lng` ≤ `ARRIVAL_MAX_DISTANCE_M` (Haversine); đạt → ghi `arrivedAt` (chỉ lần đầu), socket + push cho khách "Tài xế đã đến điểm giao".
- `POST /orders/:id/contact-attempts` (DRIVER giữ đơn, `PICKED_UP`): ghi một `DeliveryContactAttempt`; giới hạn 1 lần/30 giây. App gọi API này **ngay trước** khi mở `tel:` khách.
- `PATCH /orders/:id/status` sang `DELIVERY_FAILED` body `{ status, failedReason, cancelNote? }` chỉ hợp lệ khi: `arrivedAt` tồn tại, `now − arrivedAt ≥ FAILED_DELIVERY_MIN_WAIT_MINUTES`, và số `DeliveryContactAttempt` sau `arrivedAt` ≥ `FAILED_DELIVERY_MIN_CALLS` (với lý do `CUSTOMER_UNREACHABLE`; các lý do khác chỉ cần `arrivedAt`). Sai → 409 kèm điều kiện còn thiếu ("Cần chờ thêm 4 phút", "Cần gọi thêm 1 lần").
- Đơn `DELIVERY_FAILED`: `paymentStatus` giữ `UNPAID`, **không** ghi `COD_COLLECTED` (tài xế không thu được tiền). Tài xế vẫn được trả công chuyến đi: ghi một dòng `ADJUSTMENT` với `amount = −driverEarning`, `note = "Công giao thất bại đơn #xxxx"` (giảm nợ, nghĩa là nền tảng trả công cho tài xế), cùng transaction với việc chuyển trạng thái. Push cho khách và chủ quán. Đánh dấu khách: tăng đếm `failedDeliveryCount` trên `User` (cột mới, default 0); khách có ≥ 2 lần trong 30 ngày → `POST /orders` trả 403 "Tài khoản tạm thời không thể đặt đơn tiền mặt, liên hệ hỗ trợ" (ngưỡng đọc từ config `CUSTOMER_MAX_FAILED_DELIVERIES`, default 2).
- Mobile tài xế `DriverDeliveryDetailScreen.tsx`: nút "Đã đến điểm giao" (gửi GPS hiện tại); sau khi đến hiển thị đồng hồ chờ (tính từ `arrivedAt` server trả), số lần đã gọi; nút "Giao thất bại" chỉ bật khi đủ điều kiện, mở sheet chọn lý do.
- Mobile khách `OrderTrackingScreen.tsx`, `OrderHistoryScreen.tsx`, `utils/orderStatus.ts`, `OrderTimeline.tsx`: thêm trạng thái `DELIVERY_FAILED` và hiển thị lý do huỷ/thất bại thay cho thông báo chung.

---

### 3.6. Trụ cột D — GPS tài xế thời gian thực, điều phối theo bán kính, socket ổn định

**D1. Gửi vị trí từ app tài xế**
- Tạo hook `mobile/src/hooks/useDriverLocationReporter.ts`, gắn một lần ở `DriverTabNavigator.tsx`:
  - Chỉ chạy khi `isOnline = true` và đã cấp quyền vị trí (xin quyền foreground; giải thích rõ lý do khi từ chối và chặn bật trực tuyến).
  - `Location.watchPositionAsync({ accuracy: High, timeInterval: 4000, distanceInterval: 15 })`.
  - Đang có đơn ở `CONFIRMED`/`PREPARING`/`READY_FOR_PICKUP`/`PICKED_UP`: emit socket `driver:location { orderId, lat, lng, heading?, speed?, accuracy }` cho **từng** đơn đang giữ, tối đa 1 lần/4 giây.
  - Mọi lúc khi trực tuyến: `PATCH /drivers/me/location` tối đa 1 lần/45 giây (backend giới hạn 15 giây, giữ nguyên).
  - Tắt trực tuyến, đăng xuất, hoặc app vào nền quá lâu: dừng watch. (Không làm theo dõi nền ở Sprint này; ghi rõ là giới hạn.)
  - Web (`Platform.OS === 'web'`): dùng `navigator.geolocation.watchPosition` nếu có, không thì bỏ qua.
- Xoá `driverCoords` không dùng; `DriverAvailableOrdersScreen` bật trực tuyến thì gửi vị trí thật, không gửi `undefined`.

**D2. Backend nhận vị trí**
- `orders.gateway.ts › driverLocation`: không truy vấn DB mỗi lần. Giữ trong `client.data.activeOrders: Set<string>` (nạp khi kết nối và khi nhận các sự kiện `order:driver_assigned`/`order:status` của chính tài xế; hoặc tra DB một lần rồi cache 30 giây theo orderId). Kiểm tra toạ độ hợp lệ, giới hạn 1 sự kiện/2 giây mỗi socket. Chỉ phát vào phòng `order_<id>`.
- Mỗi 60 giây (không phải mỗi sự kiện) ghi `lastLatitude/lastLongitude/lastLocationAt` vào `DriverProfile` từ sự kiện socket mới nhất.
- `drivers.service.ts › updateStatus`: bật trực tuyến **bắt buộc** gửi `latitude/longitude` (400 nếu thiếu).

**D3. Lọc đơn theo bán kính**
- `GET /orders/available` (`orders.service.ts › findAvailableForDrivers`):
  - Yêu cầu vị trí tài xế còn mới (`lastLocationAt` trong `DRIVER_LOCATION_STALE_MINUTES`); cũ → 409 "Không xác định được vị trí của bạn, hãy bật định vị".
  - Chỉ trả đơn có quán trong `DRIVER_SEARCH_RADIUS_KM` (bounding box + Haversine trong SQL, như `restaurants.service.ts`), sắp theo khoảng cách tài xế → quán rồi theo thời gian chờ.
  - Mỗi đơn trả thêm `distanceToRestaurantKm`, `deliveryDistanceKm`, `driverEarning`, `codToCollect` (= `total`), `debtAfterAccept`.
- `order:available`: thay vì phát cho cả phòng `drivers`, server chọn tài xế **đang trực tuyến, đã duyệt, vị trí mới, trong bán kính, chưa đủ `MAX_ACTIVE_DELIVERIES`, còn hạn mức nợ** và phát tới `user_<driverId>` của từng người. Payload là **đơn đầy đủ** dạng giống phần tử của `GET /orders/available` (không phải object rút gọn như hiện tại) để `DriverAvailableOrdersScreen` hiển thị đúng tên quán và phí.
- Phát `order:available` cả khi: quán chuyển `CONFIRMED`, tài xế trả đơn (C3), và cron phát hiện đơn ứ đọng (E1).
- Khi tài xế khác nhận đơn: phát `order:taken { id }` tới các tài xế đã được báo để gỡ khỏi danh sách.
- Tài xế ngoại tuyến hoặc vị trí quá `DRIVER_OFFLINE_AFTER_MINUTES` không cập nhật: cron (E1) tự chuyển `isOnline = false` và push "Bạn đã được chuyển ngoại tuyến do mất tín hiệu định vị".

**D4. Socket ổn định ở mobile** (`mobile/src/hooks/useSocket.ts`)
- Dùng `auth: (cb) => cb({ token: useAuthStore.getState().accessToken })` để mỗi lần kết nối lại lấy token mới nhất.
- Khi server từ chối vì token hết hạn (`connect_error`), gọi luồng refresh của `api/client.ts` rồi `socket.connect()` lại. Bỏ giới hạn `reconnectionAttempts: 5` (dùng backoff mặc định).
- Khi `accessToken` đổi sang người dùng khác hoặc null: ngắt và tạo lại socket.
- Sau khi kết nối lại: tự `order:join` lại các phòng đơn đang mở (giữ danh sách trong module).
- Giảm polling: khi socket đang kết nối, `refetchInterval` = `false` (hoặc 60 giây); chỉ polling 10 giây khi socket mất kết nối. Áp dụng cho `services/useOrders.ts`, `DriverAvailableOrdersScreen.tsx` (bỏ polling 8 s/10 s/30 s chồng nhau), `DriverDeliveriesScreen.tsx`, `OwnerOrdersScreen.tsx`. Viết hook `useSocketConnected()` để dùng chung.
- `OrderTrackingScreen.tsx`: marker tài xế dùng toạ độ socket; lần đầu mở màn lấy vị trí cuối từ `GET /orders/:id` (thêm `driverLocation { lat, lng, at }` vào chi tiết đơn khi đơn có tài xế và người xem là khách/chủ quán/admin, lấy từ `DriverProfile.last*`).

---

### 3.7. Trụ cột E — Tác vụ nền, gỡ tính năng giả, đánh giá thật, công cụ admin

**E1. Cron (`@nestjs/schedule`)**
- Cài `@nestjs/schedule`, thêm `ScheduleModule.forRoot()` vào `app.module.ts`, tạo `backend/src/modules/jobs/order-jobs.service.ts`. Mỗi job chạy **mỗi phút**, có khoá chống chạy chồng (biến cờ trong tiến trình **và** `pg_try_advisory_lock` để an toàn khi chạy nhiều instance).
  1. **Quán không nhận đơn:** đơn `PENDING` quá `ORDER_PENDING_TIMEOUT_MINUTES` → `CANCELLED`, `cancelReason = RESTAURANT_TIMEOUT`, actor `SYSTEM`, dùng đúng hàm chuyển trạng thái (khoá lạc quan). Push + socket cho khách ("Quán chưa xác nhận kịp, đơn đã được huỷ") và chủ quán. Xử lý theo lô ≤ 100 đơn/lần.
  2. **Đơn ứ đọng:** đơn `READY_FOR_PICKUP` (hoặc `CONFIRMED`/`PREPARING` quá 20 phút) chưa có tài xế quá `ORDER_STALLED_PICKUP_MINUTES` và `stalledAt` còn null → ghi `stalledAt`, phát socket `order:stalled` tới phòng mới `admins` (admin tự vào phòng khi kết nối), phát lại `order:available` với bán kính × 2. Không tự huỷ.
  3. **Tài xế mất tín hiệu:** như D3.
- Unit test cho từng job với Prisma mock và thời gian giả lập.

**E2. Gỡ tính năng giả**
- Xoá `mobile/src/screens/call/DriverCallScreen.tsx`, route `DriverCall` trong `RootStack.tsx` và kiểu trong `types/navigation.ts`.
- Mọi nút gọi: `Linking.openURL('tel:<số thật từ API>')`. Không có số → nút ẩn hoặc tắt kèm chú thích. Tài xế gọi khách thì gọi API `contact-attempts` trước (C5).
- Thêm số điện thoại quán vào chi tiết đơn cho khách và tài xế (cột mới `Restaurant.phone String?`, chủ quán nhập ở `OwnerRestaurantScreen`; admin tạo quán thì lấy `ownerPhone` làm mặc định). Khách có nút gọi quán; tài xế có nút gọi quán và gọi khách.
- Chỉ cho xem số điện thoại khi đơn đang hoạt động: `ORDER_DETAIL_INCLUDE` trả `customer.phone`/`driver.phone` chỉ khi trạng thái chưa kết thúc (đơn `DELIVERED`/`CANCELLED`/`DELIVERY_FAILED` quá 2 giờ → ẩn số, trả `null`).
- **Chat:** xoá `mobile/src/screens/chat/ChatScreen.tsx`, route `Chat` ở `RootStack.tsx` và `DriverTabNavigator.tsx`, nút mở chat ở `DriverDeliveryDetailScreen.tsx`. Không giữ màn chat giả dưới bất kỳ hình thức nào. (Chat thật theo `OrderMessage` là phạm vi V5 — chỉ ghi vào mục "Việc tiếp theo" của báo cáo.)
- **Voucher:** xoá `mobile/src/screens/voucher/VoucherSelectScreen.tsx` và route; xoá ô "Mã giảm giá" mờ trong `CheckoutScreen.tsx`. Không hiển thị bất kỳ khuyến mãi nào khi backend chưa áp dụng được. Bảng `vouchers` giữ nguyên.
- Rà soát toàn bộ `mobile/src/screens` để tìm các dữ liệu cứng còn sót (số liệu thống kê mẫu, tên tài xế mẫu, ảnh mẫu, mảng hằng số thay cho API) và thay bằng dữ liệu API hoặc trạng thái trống. Liệt kê kết quả rà soát trong báo cáo.
- Tiêu đề push trong `notifications.service.ts`: bỏ emoji.

**E3. Đánh giá theo đơn**
- `POST /orders/:id/review` body `{ rating (1–5), comment? (≤500), driverRating? (1–5), driverComment? (≤300) }`:
  - Đơn của chính khách, trạng thái `DELIVERED`, trong `REVIEW_WINDOW_DAYS` kể từ lúc giao (lấy từ `OrderStatusHistory`).
  - Mỗi đơn đúng một đánh giá: dựa vào `Review.orderId @unique` (bắt lỗi P2002 → 409 "Bạn đã đánh giá đơn này"). Bỏ cách đếm hiện tại.
  - `driverRating` chỉ nhận khi đơn có tài xế; lưu `driverId`.
  - Cập nhật `Restaurant.rating` và `ratingCount` bằng aggregate **chỉ trên đánh giá chưa ẩn**, trong cùng transaction.
- `GET /orders/:id` trả thêm `review` (nếu có) và `canReview` (boolean, đã tính hạn).
- `GET /restaurants/:id/reviews?page&limit&rating` (Public): đánh giá chưa ẩn, tên khách rút gọn ("Nguyễn V. A."), không lộ email/số điện thoại, kèm `ownerReply`.
- `GET /restaurants/:id/reviews/manage` (OWNER của quán, ADMIN): đủ thông tin kể cả mã đơn, lọc "chưa trả lời".
- `POST /reviews/:id/reply` (OWNER của quán) body `{ reply (1–500) }`: **chỉ một lần** (`ownerReply` null), 409 nếu đã trả lời. Push cho khách.
- `PATCH /admin/reviews/:id/visibility` body `{ isHidden, reason }` → audit, tính lại điểm quán.
- Điểm tài xế: `GET /drivers/me` và chi tiết tài xế cho admin trả `ratingAvg`, `ratingCount` (aggregate từ `Review.driverRating`).
- Mobile:
  - `RatingScreen.tsx`: hai phần riêng "Đánh giá quán" và "Đánh giá tài xế" (ẩn nếu đơn không có tài xế); gửi đúng trường; thẻ nhanh chỉ là gợi ý chèn vào ô nhận xét; xoá `driverName` truyền thừa nếu không dùng.
  - Lối vào đánh giá: màn theo dõi đơn **và** thẻ đơn trong `OrderHistoryScreen.tsx` khi `canReview`.
  - `RestaurantDetailScreen.tsx`: mục "Đánh giá" (điểm, số lượt, danh sách phân trang, phản hồi của quán).
  - App chủ quán: tab hoặc màn "Đánh giá" (`OwnerReviewsScreen.tsx`) — danh sách, lọc chưa trả lời, ô trả lời một lần.

**E4. Công cụ điều hành cho admin**
- Màn mới `AdminOrdersScreen.tsx` (tab trong `AdminTabNavigator.tsx`) dùng `GET /admin/orders` (đã có) + bộ lọc trạng thái, "ứ đọng", tìm theo mã đơn/số điện thoại.
- Chi tiết đơn cho admin: lịch sử trạng thái, người đổi, lý do, vị trí tài xế cuối, số lần gọi, nút "Huỷ đơn" (bắt buộc ghi chú) và "Gỡ tài xế" (`POST /admin/orders/:id/unassign-driver`, audit, phát lại `order:available`).
- Dashboard: số đơn ứ đọng, số quán chờ duyệt, tổng công nợ COD chưa thu, nghe socket `order:stalled`.

---

### 3.8. Các lỗi nhỏ khác phải sửa trong V4

| # | Lỗi | Vị trí | Cách sửa |
|---|---|---|---|
| 1 | Socket `order:available` gửi object rút gọn, màn tài xế hiển thị "Nhà hàng" và phí rỗng | `orders.gateway.ts`, `DriverAvailableOrdersScreen.tsx` | Payload đầy đủ (D3) |
| 2 | Thống kê tài xế tính theo ngày tạo đơn | `orders.service.ts › getDriverStats`, `driver-stats.ts` | Theo ngày giao (C4) |
| 3 | Thu nhập tài xế = 100% phí ship | `driver-stats.ts` | Dùng `driverEarning` |
| 4 | Mobile làm tròn khoảng cách 0,1 km trước khi tính phí, lệch backend | `mobile/src/utils/fee.ts` | Xoá logic tính phí ở client (B5) |
| 5 | Checkout không cho đổi địa chỉ, trang chủ dùng GPS còn checkout dùng địa chỉ lưu | `CheckoutScreen.tsx`, `HomeScreen.tsx` | B5 |
| 6 | Deep link VNPay mở màn Checkout với `orderId` 8 ký tự | `mobile/App.tsx`, `payments.service.ts` | Bỏ deep link (C1) |
| 7 | IPN thành công sau khi đơn bị huỷ vẫn đặt `PAID` | `payments.service.ts › handleIpn` | Dù đã ngừng VNPay, thêm kiểm tra: đơn `CANCELLED` → đặt `REFUNDED`, ghi log |
| 8 | Socket/push phát trong transaction của IPN | `payments.service.ts` | Chuyển ra sau commit |
| 9 | Chủ quán xoá quán đã có đơn → lỗi khoá ngoại | `restaurants.service.ts › delete` | A2 |
| 10 | `Restaurant.rating` không có số lượt | `schema.prisma` | `ratingCount` (3.2) |
| 11 | Tài xế bật trực tuyến không gửi vị trí, tắt app vẫn "trực tuyến" mãi | `drivers.service.ts`, cron | D2, D3 |
| 12 | Cache và giới hạn tốc độ Maps phình không giới hạn | `maps/utils/rate-limiter.util.ts`, `maps.controller.ts` | LRU có giới hạn (B1); dọn các khoá cũ trong `UserMapRateLimiter` |
| 13 | `MAX_ACTIVE_DELIVERIES` viết cứng | `orders.service.ts:58` | Config (3.1) |
| 14 | Push có emoji | `notifications.service.ts` | E2 |
| 15 | `useLocation` trả toạ độ TP.HCM giả khi bị từ chối quyền | `mobile/src/hooks/useLocation.ts` | Trả `coords: null` + trạng thái lỗi; màn hình xử lý trạng thái trống (B5) |
| 16 | Không có giờ mở cửa theo ngày | `Restaurant` | **Không** làm ở V4; ghi vào "Việc tiếp theo" |

---

## 4. Kế hoạch Sprint (làm tuần tự, mỗi Sprint một commit)

| Sprint | Nội dung | Mục |
|---|---|---|
| 0 | Sao lưu DB, commit file chưa theo dõi, cập nhật `.gitignore` | 1.1, 1.2 |
| 1 | Cấu hình `business`, migration `v4_business_upgrade` + seed, bảo mật & kiểm duyệt quán, khoá tài khoản tức thời, audit | 3.1, 3.2, 3.3 |
| 2 | Adapter khoảng cách + cache, `POST /orders/quote`, đặt đơn bằng quote + idempotency, mobile một nguồn địa chỉ, checkout mới, xoá tính phí ở client | 3.4 |
| 3 | Chỉ COD, máy trạng thái mới, lý do huỷ, tài xế trả đơn, công nợ `DriverLedger`, giao thất bại, ví tài xế, công nợ ở admin | 3.5 |
| 4 | GPS tài xế, điều phối theo bán kính, payload socket đầy đủ, socket làm mới token, giảm polling | 3.6 |
| 5 | Cron jobs, gỡ Chat/Gọi giả/Voucher, số điện thoại quán, đánh giá theo đơn + trả lời, màn quản lý đơn của admin, các lỗi nhỏ 3.8 | 3.7, 3.8 |

Một migration duy nhất cho toàn bộ thay đổi schema ở Sprint 1 là ưu tiên. Nếu Sprint sau phát hiện thiếu cột, tạo migration bổ sung nhỏ (`v4_<noi_dung>`), **không** sửa migration đã chạy.

---

## 5. Cập nhật tài liệu API

Cập nhật `docs/API_CONTRACT.md`: thêm/sửa mọi endpoint ở mục 3 (method, quyền, body, response mẫu, các mã lỗi và thông báo). Đánh dấu endpoint VNPay là "tạm ngừng".

---

## 6. Tiêu chuẩn nghiệm thu

### 6.1. Lệnh phải chạy xanh
```bash
# backend/
npx prisma validate
npx prisma migrate status            # "Database schema is up to date"
npx tsc --noEmit -p tsconfig.build.json
npm run lint
npm test

# mobile/
npx tsc --noEmit
npx jest                             # nếu dự án có cấu hình jest
npx expo export -p web
npx expo export -p ios
```

### 6.2. Unit test bắt buộc (mới hoặc cập nhật)
- `auth.service.spec.ts`: đăng ký luôn `CUSTOMER`; tài khoản bị khoá bị từ chối ở `JwtStrategy`.
- `order-state-machine.spec.ts`: mọi cạnh trong C2, đúng actor, lý do huỷ hợp lệ.
- `order-pricing` / quote: phí làm tròn lên 1.000đ, phụ phí cao điểm, token sai/hết hạn/giá đổi → 400/409.
- Maps adapter: cache theo toạ độ làm tròn, fallback `ESTIMATED` × 1,3 khi Goong lỗi.
- Ledger: ghi nợ đúng `subtotal + platformCommission`, không ghi trùng, chặn nhận đơn khi vượt hạn mức, nộp tiền không vượt số dư.
- Giao thất bại: thiếu thời gian chờ / thiếu cuộc gọi / quá xa điểm giao → 409 với thông báo đúng.
- Cron: huỷ đơn `PENDING` quá hạn, không đụng đơn đã `CONFIRMED`, đánh dấu ứ đọng một lần.
- Đánh giá: một lần mỗi đơn, ngoài hạn bị từ chối, trả lời một lần, ẩn đánh giá làm điểm quán tính lại.
- `driver-stats.spec.ts`: theo ngày giao, dùng `driverEarning`.

### 6.3. Kịch bản kiểm tra thủ công (ghi kết quả vào báo cáo)
Dùng tài khoản seed (`*@fooddelivery.com` / mật khẩu trong `seed.ts`), backend chạy `npm run start:dev`:
1. Gọi `POST /auth/register` có `"role": "RESTAURANT_OWNER"` → 400.
2. Chủ quán tạo quán mới → không thấy trên trang chủ của khách; admin duyệt → thấy.
3. Admin khoá một khách đang đăng nhập → request tiếp theo của khách (≤ 30 giây) bị 401, socket bị ngắt.
4. Khách chọn địa chỉ ở trang chủ → checkout dùng đúng địa chỉ đó; báo giá hiện nguồn khoảng cách; đổi giá món ở app chủ quán rồi đặt → 409 và hộp thoại xác nhận giá mới.
5. Quán không nhận đơn trong 5 phút → đơn tự huỷ, khách nhận thông báo.
6. Tài xế bật trực tuyến ở gần quán → thấy đơn; tài xế ở xa (> bán kính) → không thấy.
7. Tài xế nhận đơn, di chuyển → khách thấy marker tài xế cập nhật.
8. Giao thành công đơn COD → công nợ tài xế tăng đúng; vượt hạn mức → không nhận được đơn mới; admin ghi nhận nộp tiền → nhận lại được.
9. Báo giao thất bại trước 10 phút → bị từ chối; đủ điều kiện → thành công.
10. Khách đánh giá quán + tài xế; đánh giá lần hai → 409; chủ quán trả lời; trả lời lần hai → 409.
11. Lệnh tìm ở mục 1.5 không còn kết quả.

---

## 7. Báo cáo cuối

Tạo `docs/BAO_CAO_NANG_CAP_V4.md` gồm:
1. Tóm tắt kết quả theo 5 trụ cột và bảng 3.8 (đã làm / chưa làm / lý do).
2. Danh sách migration, bảng/cột mới, cách xử lý dữ liệu cũ, lệnh sao lưu đã chạy.
3. Danh sách endpoint mới/đổi.
4. Biến `.env` mới và giá trị mặc định.
5. Kết quả các lệnh ở 6.1 và kịch bản 6.3 (đạt/không đạt, ghi chú).
6. Các quyết định đã tự chọn khi gặp điểm mơ hồ.
7. Giới hạn còn lại và **Việc tiếp theo (V5)**: chat theo đơn (`OrderMessage` + socket), gọi ẩn số qua tổng đài, theo dõi vị trí khi app chạy nền, voucher thật phía server, giờ mở cửa theo ngày, thanh toán online trở lại, Redis adapter cho Socket.IO và cache dùng chung khi chạy nhiều instance.
