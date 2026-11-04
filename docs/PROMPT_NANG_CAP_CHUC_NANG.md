# PROMPT: Nâng cấp chức năng ứng dụng giao đồ ăn ZomZom

> Dành cho AI lập trình (Claude Code…) làm việc trực tiếp trong repo `food-delivery-system`.
> Nên giao **từng đợt một** (ví dụ: "Thực hiện ĐỢT 1 trong docs/PROMPT_NANG_CAP_CHUC_NANG.md").
> Trung tâm trợ giúp / chatbot của khách có prompt riêng: `docs/PROMPT_TRUNG_TAM_TRO_GIUP.md`.

---

## TIẾN ĐỘ (cập nhật 03/11/2026)
Thứ tự đang làm: **từ dễ đến khó, xong một chức năng thì báo cáo và chờ người dùng xác nhận** mới làm tiếp.
Chức năng đã xong có dấu ✅ ngay tại mục tương ứng bên dưới.

| # | Chức năng | Thuộc mục | Trạng thái |
|---|---|---|---|
| 1 | Sẵn sàng deploy: container tự `migrate deploy`, `.env.example`, `docs/DEPLOY.md` | 2.2 | ✅ Xong |
| 2 | Chia sẻ quán/món: link https ngắn `/s/r/:id`, `/s/d/:id` có thẻ xem trước + deep link | 5 | ✅ Xong |
| 3 | Xuất CSV: đơn hàng (admin), doanh thu (chủ quán) | 6 | ✅ Xong |
| – | Tổng quan admin nâng cao, nhật ký quản trị, xem công nợ COD | 6 | ✅ Xong (làm trong `PROMPT_REDESIGN_ADMIN.md`) |
| 4 | Xoá tài khoản (bắt buộc khi lên store) | 10.4 | ✅ Xong |
| 6 | Tạm nghỉ quán có hẹn giờ | 4.2 | ✅ Xong |
| 5 | Món bán theo khung giờ | 4.4 | ✅ Xong |
| 7 | Ảnh lên Cloudinary + script chuyển ảnh | 2.1 | ✅ Xong |
| 8 | Trung tâm thông báo 🔔 | 4.1 | ✅ Xong |
| 9 | Giờ mở cửa theo ngày + ngày nghỉ | 4.2 | ✅ Xong |
| 10 | Chuông báo đơn mới (kèm push có âm thanh) | 4.3, 10.3 | ✅ Xong |
| 11 | Tài xế: mục tiêu thu nhập, khu vực nhiều đơn | 4.5 | ⏳ Chưa làm |
| 12 | Tìm kiếm có lọc/sắp xếp: sắp xếp (phù hợp / gần nhất / đánh giá cao / phổ biến), lọc khoảng cách, phí ship tối đa, từ 4★/4,5★, đang mở, có ưu đãi; nhãn ưu đãi trên thẻ quán; tải thêm khi cuộn | 5 | ✅ Xong (04/11/2026) |
| 13 | Đánh giá kèm ảnh: tối đa 3 ảnh (Cloudinary `reviews`), màn "Tất cả đánh giá" (điểm TB, biểu đồ theo sao, lọc có ảnh / theo sao, xem ảnh phóng to), chủ quán/admin ẩn ảnh có lý do + nhật ký, hiện lại | 5 | ✅ Xong (04/11/2026) |
| 14 | Quên mật khẩu OTP email: 3 bước (email → mã 6 số → mật khẩu mới), mã băm, 10 phút, sai 5 lần khoá mã, gửi lại sau 60 giây, phản hồi như nhau dù email có tồn tại, đăng xuất mọi thiết bị + email báo đổi mật khẩu, AuditLog `USER_PASSWORD_RESET`; màn `ForgotPassword` + link ở Đăng nhập | 5 | ✅ Xong (04/11/2026) |
| 15 | Đăng nhập Google: `POST /auth/google` (xác minh idToken bằng google-auth-library, chỉ nhận email đã xác minh), tự liên kết tài khoản cùng email, tạo khách mới (cột `users.googleId`), màn bắt buộc "Hoàn tất hồ sơ" nhập SĐT; nút ở Đăng nhập + Đăng ký | 5 | ✅ Xong trên web (04/11/2026). Android/iOS: cần thêm `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` / `_IOS_` + thêm ID vào `GOOGLE_CLIENT_IDS`, build lại APK |
| 16a | Voucher: giảm tiền / % / freeship, mã sàn + mã quán + mã cá nhân, giữ & hoàn lượt, ví voucher, quản lý cho admin & chủ quán, bồi thường khiếu nại bằng voucher | 3 | ✅ Xong (04/11/2026) |
| 16b | Chính sách huỷ (lý do bắt buộc, nhắc khi huỷ nhiều, tạm hạn chế khi huỷ ≥4 đơn/7 ngày, huỷ sau khi quán nhận qua CSKH) + hoàn tiền VNPay "chờ hoàn tiền" và màn Hoàn tiền cho admin | 10.1, 10.2 | ✅ Xong (04/11/2026) |
| 17 | Đối soát & thanh toán cho quán | 10.5 | ⏳ Chưa làm (sau Voucher) |
| 18 | Trung tâm trợ giúp (FAQ, báo vấn đề theo đơn, phiếu hỗ trợ, chatbot Gemini) | 6 (prompt riêng) | ✅ Phần lớn xong; còn màn admin soạn FAQ, thống kê chatbot. Cron xoá hội thoại bot không hoạt động 90 ngày ✅ (04/11/2026, `handleCleanOldBotConversations`) |
| 19 | Sentry mobile, rà CI | 7 | ⏳ Chưa làm (CI đã có) |
| 21 | Món hết & kiểm tra giỏ (mục 8.5, làm theo GrabFood/ShopeeFood): `POST /cart/check` báo từng món hết / ngừng bán / ngoài giờ / đổi giá / tuỳ chọn đổi + trạng thái quán; quán chọn "Hết hôm nay" (tự mở lại 04:00, cột `menu_items.soldOutUntil` + cron) hoặc "Hết đến khi bật lại" (`PATCH /menu-items/:id/stock`); realtime `menu:stock` qua phòng `restaurant_{id}`; Giỏ hàng có thẻ cảnh báo + nút xoá món hết / cập nhật giá, Thanh toán chặn đặt khi có món hết | 8.5 | ✅ Xong (04/11/2026) |
| 20 | Giới hạn tần suất: đăng nhập sai (khoá tạm theo tài khoản+IP / tài khoản / IP, nhắc số lần còn lại), đăng ký theo IP, báo giá, tạo đơn (theo idempotency-key), dò mã voucher (8 mã sai khác nhau / 15 phút), lưới chung 600 yêu cầu/phút; 429 có `code: RATE_LIMITED` + `Retry-After`; biến `RATE_LIMIT_ENABLED`, `TRUST_PROXY` | 10.9 | ✅ Xong (04/11/2026). Đếm trong bộ nhớ: chạy nhiều instance thì cần chuyển sang Redis |

Đã làm thêm ngoài prompt: đăng ký **bắt buộc số điện thoại** đúng định dạng VN (backend + mobile); làm lại giao diện Đăng nhập/Đăng ký.

---

## 0. Bối cảnh dự án (đọc kỹ trước khi làm)
- Monorepo:
  - `backend/`: NestJS + Prisma + PostgreSQL, Socket.IO realtime, `@nestjs/schedule` (cron mỗi phút).
  - `mobile/`: Expo SDK 58 + React Native 0.88 + NativeWind + React Query + Zustand.
- 4 vai trò: CUSTOMER, RESTAURANT_OWNER, DRIVER, ADMIN. Thanh toán chủ yếu COD; VNPay ở chế độ sandbox.
- Backend chạy bằng Docker: `docker compose up -d --build backend`, Postgres cổng 5433. Migration chạy từ máy: `cd backend && npx prisma migrate dev --name <ten>`.
- Đã có sẵn:
  - Cloudinary (khoá trong `backend/.env`), `ImageStorageService` ở `backend/src/modules/content/` (tải data URI lên Cloudinary, lỗi thì lưu `public/uploads`).
  - Goong Maps (khoảng cách, Direction), Expo push, `AuditLog`, quản lý banner/danh mục cho admin.
  - Bảng `Voucher` trong schema nhưng CHƯA dùng.
- Bộ khối UI dùng chung:
  - `mobile/src/components/modules/partner/PartnerKit.tsx`: SectionCard, SegmentedTabs, NoticeCard, Money, MetricChip, RoundAction, dayLabel, clockTime, timeAgo…
  - `components/modules/owner/OwnerKit.tsx`, `components/modules/admin/ContentKit.tsx`, `components/ui/*`.
- Công thức dùng chung, KHÔNG viết công thức mới song song:
  - Thời gian giao: `backend/src/common/utils/delivery-time.ts` (bản sao ở `mobile/src/utils/fee.ts`).
  - Phí ship: `calcDeliveryFeeBreakdown` trong `backend/src/common/utils/geo.util.ts`.
  - Giờ mở cửa: `backend/src/common/utils/opening-hours.ts` (bản sao ở `mobile/src/utils/openingHours.ts`).
  - Báo giá đơn: `backend/src/modules/orders/order-pricing.service.ts` (quote có `quoteToken`, hết hạn sau 10 phút, trả 409 `QUOTE_CHANGED` khi giá đổi).

## 1. Quy tắc bắt buộc
1. **Giữ giao diện nhiều màu hiện tại.** Không làm "tối giản màu", không đổi giao diện các màn không liên quan. Màn mới làm theo đúng kiểu của PartnerKit: thẻ `rounded-2xl bg-surface shadow-card`, nền `bg-canvas-subtle`.
2. `cn()` trong `components/ui/cn.ts` chỉ NỐI chuỗi, KHÔNG gộp class trùng → không truyền class đè lên class mặc định cùng thuộc tính (màu nền, chiều cao…). Hãy thêm prop riêng (ví dụ `surfaceClassName`, `trackClassName`, `large`).
3. iOS: `Animated.View` của Reanimated được đăng ký với NativeWind; KHÔNG truyền mảng style `[tĩnh, animated]`. Mỗi `Animated.View` chỉ một style động, phần tĩnh đặt bằng className ở view con.
4. Không có cấu hình Prettier: KHÔNG chạy `prettier --write` mặc định (nó đổi sang nháy kép). Nếu cần thì dùng `--single-quote --trailing-comma all --print-width 110`.
5. Lint React Compiler đang bật (`react-hooks/refs`, `set-state-in-effect`, không sửa giá trị lấy từ `useState`): tuân thủ, không tắt quy tắc bằng comment trừ khi có lý do ghi rõ.
6. Comment và thông báo lỗi viết **tiếng Việt**, ngắn gọn, giải thích "vì sao".
7. Mọi logic nghiệp vụ mới ở backend: tách thành **hàm thuần** và có **test Jest** (đặt cạnh file, đuôi `.spec.ts`). Cuối mỗi đợt chạy đủ: `npx tsc --noEmit`, `npx jest`, `npx eslint` cho cả backend và mobile.
8. Migration Prisma chỉ THÊM (cột nullable / bảng mới / index); không xoá cột, không đổi kiểu dữ liệu cũ. Đọc file SQL migration trước khi áp dụng.
9. Trước khi sửa một màn lớn: sao lưu file vào thư mục scratchpad. KHÔNG commit, không push. Báo cáo những gì đã sửa.
10. Không dùng dịch vụ tốn phí (SMS OTP, cổng thanh toán thật, gọi ẩn số). Gói free (Gmail SMTP, Cloudinary, Goong, Expo push, Sentry free, Gemini free tier) thì được.
11. Sau mỗi đợt: build lại backend Docker và thử API thật bằng tài khoản mẫu (mật khẩu `Password123!`: `customer`, `owner`, `driver`, `admin`). Không in khoá bí mật ra terminal.

## 2. ĐỢT 1: Ảnh lên Cloudinary + nền tảng

### 2.1 Chuyển toàn bộ ảnh sang Cloudinary ✅ (Đã hoàn thành 03/11/2026)
- **Đã triển khai:**
  - **Module `media` toàn cục (`MediaModule`):** Cung cấp `MediaService` tự động tiêm vào toàn bộ hệ thống. Thư mục Cloudinary: `zomzom/{avatars|restaurants|dishes|banners|cuisines|reviews|support}`.
  - **Hàm `resolveImage(value, folder)`:**
    - Xử lý chuỗi rỗng / `null` / `undefined` -> trả về `null`.
    - Giữ nguyên link `http(s)` và link cục bộ `/public/...`.
    - Tự động nhận diện chuỗi `data:image/` base64 -> nén và tải lên Cloudinary với signed upload bảo mật qua REST API.
    - Tự động fallback lưu tạm trên server (`public/uploads/...`) nếu mất kết nối Cloudinary.
  - **Tối ưu CDN `f_auto,q_auto,c_limit,w_X`:** Tự động chèn tham số biến đổi hình ảnh theo từng loại: banner (1600px), ảnh quán (1200px), món ăn / đánh giá / hỗ trợ (800px), avatar / danh mục (400px).
  - **Áp dụng toàn diện:**
    - `UsersService`: `uploadAvatar` tải buffer lên Cloudinary thư mục `zomzom/avatars`, `updateMe` gọi `resolveImage`.
    - `RestaurantsService`: `create` và `update` gọi `resolveImage` với folder `restaurants`.
    - `MenusService`: `createItem` và `updateItem` gọi `resolveImage` với folder `dishes`.
    - `ContentService`: `createBanner`, `updateBanner`, `createCuisine`, `updateCuisine` gọi `resolveImage`.
    - `ContentController`: endpoint upload ảnh dùng chung hoạt động ổn định.
  - **Script di chuyển dữ liệu (`backend/scripts/migrate-images-to-cloudinary.ts`):**
    - Hỗ trợ cờ `--dry-run` để kiểm tra trước số lượng ảnh cần chuyển mà không ghi đè DB.
    - Quét cả 5 bảng: `User`, `Restaurant`, `MenuItem`, `Banner`, `CuisineCategory`.
    - Cơ chế gộp trùng (dedup cache): các món / banner dùng chung 1 ảnh mẫu chỉ tải lên Cloudinary 1 lần duy nhất và gán cùng link CDN.
    - Lệnh chạy: `npm run --prefix backend migrate:images` (hoặc thêm `-- --dry-run`).
  - **Kiểm thử & Chất lượng:**
    - Đầy đủ Jest unit tests: `media.util.spec.ts` (7 tests), `media.service.spec.ts` (5 tests).
    - Toàn bộ 39 backend test suites (240 tests) pass 100%, 0 lint errors, build `nest build` thành công.
- **Nhận xét cải tiến & Đề xuất phát triển thêm:**
  - *Xoá ảnh cũ (Garbage Collection):* Khi chủ quán cập nhật ảnh mới cho món ăn, có thể bổ sung hàng đợi xoá ảnh cũ trên Cloudinary qua Admin API để tiết kiệm dung lượng lưu trữ lâu dài.
  - *Lazy migration background job:* Có thể lập lịch cron di chuyển ảnh vào ban đêm nếu hệ thống có hàng vạn bản ghi lớn.

### 2.2 Sẵn sàng deploy (không tốn phí) ✅
> Đã làm: `backend/docker-entrypoint.sh` chạy `prisma migrate deploy` trước khi khởi động (tắt bằng `RUN_MIGRATIONS=false`);
> Dockerfile cài đúng phiên bản Prisma CLI theo package-lock; `.gitattributes` giữ LF cho `*.sh`; log cảnh báo khi production
> còn dùng khoá mẫu `change_me…` (chỉ cảnh báo, không chặn, vì docker compose ở máy dev cũng chạy `NODE_ENV=production`).
- Dockerfile: thêm bước chạy `prisma migrate deploy` khi container khởi động (gói `prisma` CLI hiện chỉ ở devDependencies → xử lý hợp lý, ví dụ copy CLI từ stage build hoặc thêm script `start:prod`).
- `.env.example`: cập nhật đủ biến mới, ghi chú biến nào bắt buộc khi production (`NODE_ENV`, JWT secrets mới, `CORS_ORIGINS`, `VNPAY_RETURN_URL` phải là link công khai).
- Viết `docs/DEPLOY.md`: hướng dẫn Render + Neon (miễn phí, có lưu ý máy chủ ngủ làm cron ngừng) và Oracle Cloud Always Free + docker compose + DuckDNS + Caddy; build APK Android bằng EAS.

## 3. ĐỢT 2: Voucher / mã giảm giá (đúng nghiệp vụ)
- Dùng/mở rộng bảng `Voucher` (thêm cột nếu thiếu):
  - `code` (duy nhất, chữ hoa), `type` PERCENT | FIXED | FREESHIP, `value`, `maxDiscount` (trần cho PERCENT).
  - `minSubtotal`, `startAt`/`endAt`, `totalLimit`, `perUserLimit`, `isActive`.
  - Phạm vi: toàn hệ thống hoặc một quán (`restaurantId` nullable), `onlyNewCustomer` (chỉ khách chưa có đơn giao thành công).
  - Ai chịu chi phí: `fundedBy` PLATFORM | RESTAURANT.
- Bảng `VoucherUsage` (voucherId, userId, orderId, discountAmount, createdAt) để đếm lượt.
- Tính giá trong `order-pricing.service.ts`:
  - Quote nhận `voucherCode` tuỳ chọn; trả `voucherDiscount`, `shippingDiscount` và lý do không áp dụng được ("Đơn tối thiểu 100.000 ₫", "Mã đã hết lượt"…).
  - `quoteToken`/cartHash phải bao gồm mã voucher.
  - FREESHIP chỉ giảm phí ship, không giảm tiền món. Tổng không âm.
  - Khi tạo đơn: kiểm tra lại voucher trong **transaction** (khoá hàng hoặc kiểm tra lượt có điều kiện) để không vượt `totalLimit` khi nhiều người dùng cùng lúc; ghi `VoucherUsage`.
  - Đơn bị huỷ hoặc giao thất bại → **hoàn lượt** voucher.
  - Lưu snapshot trên Order: `voucherCode`, `discountAmount`.
- Ảnh hưởng tiền:
  - Voucher do PLATFORM chịu: quán vẫn nhận đủ tiền món.
  - Voucher do RESTAURANT chịu: doanh thu quán trừ phần giảm (cập nhật `restaurant-stats`).
  - COD: tài xế thu `total` sau giảm; công nợ COD tính đúng theo số tiền thực thu (kiểm tra `DriverLedger`).
- Voucher **bồi thường**: hỗ trợ tạo voucher cá nhân (gắn `userId`, dùng 1 lần) để Trung tâm trợ giúp tặng khi xử lý khiếu nại (xem prompt Trung tâm trợ giúp).
- API:
  - Khách: `GET /vouchers/available?restaurantId=` (mã khả dụng kèm lý do chưa đủ điều kiện) và "Ví voucher" của tôi.
  - Admin: CRUD toàn hệ thống. Chủ quán: CRUD voucher của quán mình (`fundedBy=RESTAURANT`).
  - Ghi AuditLog.
- Mobile:
  - Checkout có ô "Mã giảm giá" + bảng chọn voucher (mã dùng được xếp trên, mã chưa đủ điều kiện mờ kèm lý do). Dòng giảm giá trong Chi tiết thanh toán.
  - Màn "Ví voucher" trong tab Tài khoản của khách.
  - Màn quản lý voucher cho admin (tab Hệ thống) và cho chủ quán (màn Cửa hàng).
  - Trang chủ hiện voucher nổi bật nếu có.
- Test: mọi loại voucher, trần giảm, đơn tối thiểu, hết hạn, hết lượt, giới hạn mỗi người, hoàn lượt khi huỷ, freeship, voucher cá nhân.

## 4. ĐỢT 3: Trung tâm thông báo + trải nghiệm đối tác
### 4.1 Trung tâm thông báo 🔔
- Bảng `Notification` (userId, type, title, body, data JSON (orderId, ticketId…), readAt, createdAt; index userId + createdAt).
- `NotificationsService` hiện đang gửi push: mỗi lần gửi thì **lưu thêm** một bản ghi; đồng thời phát socket `notification:new`.
- API: danh sách có phân trang, đếm chưa đọc, đánh dấu đã đọc một / tất cả. Cron xoá thông báo cũ hơn 90 ngày.
- Mobile: biểu tượng chuông có số chưa đọc trên header của cả 4 vai trò; màn danh sách nhóm theo ngày; bấm vào mở đúng màn (đơn, chat, phiếu hỗ trợ…).

### 4.2 Chủ quán: tạm nghỉ & giờ mở cửa theo ngày
- ✅ **Tạm nghỉ quán có hẹn giờ (`Restaurant.pausedUntil` - Đã hoàn thành 03/11/2026):**
  - **Đã triển khai:**
    - Schema & Migration: Bổ sung cột `pausedUntil TIMESTAMP(3)` kèm index `restaurants_pausedUntil_idx` trên bảng `restaurants` (migration `20261103141500_restaurant_paused_until`).
    - Backend:
      - Tiện ích [restaurant-pause.util.ts](file:///d:/food-delivery-system/backend/src/common/utils/restaurant-pause.util.ts) hỗ trợ các mốc `30m`, `1h`, `2h`, `today` (chuẩn giờ VN UTC+7) và tính thời gian còn lại.
      - Hàm [isAcceptingOrders](file:///d:/food-delivery-system/backend/src/common/utils/opening-hours.ts) và [order-pricing.service.ts](file:///d:/food-delivery-system/backend/src/modules/orders/order-pricing.service.ts) tự động chặn nhận đơn khi quán đang tạm nghỉ có hẹn giờ.
      - Cron job [order-jobs.service.ts](file:///d:/food-delivery-system/backend/src/modules/jobs/order-jobs.service.ts) (`handleExpiredPausedRestaurants`) chạy mỗi phút tự động reset `pausedUntil = null` khi hết thời gian hẹn.
      - API `PATCH /api/v1/restaurants/:id` hỗ trợ `pauseMode` ('30m' | '1h' | '2h' | 'today' | 'cancel') hoặc `pausedUntil`. Tự động huỷ mốc tạm nghỉ khi chủ quán gạt switch mở lại quán (`isOpen = true`).
    - Mobile:
      - Thẻ [StoreStatusCard.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/owner/OwnerKit.tsx) hiển thị 4 nút chọn nhanh mốc tạm nghỉ (30 phút, 1 giờ, 2 giờ, Hết ngày). Khi đang tạm nghỉ, thẻ hiển thị cảnh báo đỏ/cam, đếm ngược tự động và nút **"Mở lại ngay"**.
      - Khách hàng xem [RestaurantDetailScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/restaurant/RestaurantDetailScreen.tsx) nhận thông báo rõ ràng: *"Quán đang tạm nghỉ, tự mở lại lúc HH:mm. Bạn có thể xem thực đơn trước."* kèm badge *"Tạm nghỉ"*.
      - Kiểm thử: 14/14 unit tests backend (`opening-hours`, `restaurant-pause`, `order-jobs`) và 58 tests mobile pass 100%.
  - **Nhận xét cải tiến & Đề xuất phát triển thêm:**
    - *Lý do tạm nghỉ:* Bổ sung tuỳ chọn lưu lý do (ví dụ: "Quán quá tải đơn", "Hết nguyên liệu đột xuất", "Có việc gia đình") để hiển thị giải thích chi tiết hơn cho khách hàng.
    - *Thông báo đẩy khi mở lại:* Khi quán tự động mở lại sau giờ hẹn, có thể phát socket / gửi thông báo nhẹ cho khách hàng đang lưu quán trong danh sách yêu thích.
- ✅ **Giờ mở cửa theo ngày trong tuần & ngày nghỉ đặc biệt (Đã hoàn thành 03/11/2026):**
  - **Đã triển khai:**
    - Schema & Migration:
      - Bổ sung bảng `RestaurantOpeningHour` (`id`, `restaurantId`, `dayOfWeek` 0–6, `openTime` HH:mm, `closeTime` HH:mm, `isClosed`, `createdAt`, `updatedAt`) kèm unique composite `[restaurantId, dayOfWeek]` và quan hệ xóa cascade.
      - Bổ sung bảng `RestaurantSpecialClosing` (`id`, `restaurantId`, `date` YYYY-MM-DD, `reason`, `createdAt`) kèm unique composite `[restaurantId, date]` và index theo `restaurantId`.
      - Migration: `20261103170000_restaurant_opening_hours_and_closings`.
    - Backend:
      - Tiện ích [opening-hours.ts](file:///d:/food-delivery-system/backend/src/common/utils/opening-hours.ts):
        - Hỗ trợ hàm `isSpecialClosing`: kiểm tra quán có đang đóng cửa do rơi vào ngày nghỉ đặc biệt (lễ, Tết, sửa quán) hay không theo ngày hiện tại giờ VN (UTC+7).
        - Hỗ trợ hàm `isWithinWeeklySchedule`: kiểm tra thời gian phục vụ của ngày trong tuần (CN=0 .. T7=6), tự động xử lý khung giờ trong ngày (VD: `07:00 – 22:00`) và khung giờ mở xuyên đêm sang sáng hôm sau (VD: `18:00 – 02:00`).
        - Tương thích ngược 100%: nếu quán chưa thiết lập lịch 7 ngày, hàm tự fallback về cặp `openTime` / `closeTime` mặc định của quán.
        - Tích hợp kiểm tra đồng bộ trong `isAcceptingOrders` và chặn tạo đơn trong [order-pricing.service.ts](file:///d:/food-delivery-system/backend/src/modules/orders/order-pricing.service.ts).
      - DTOs & Validation: [restaurant-schedule.dto.ts](file:///d:/food-delivery-system/backend/src/modules/restaurants/dto/restaurant-schedule.dto.ts) với `WeeklyScheduleDto`, `DayScheduleDto` (kiểm tra `dayOfWeek` 0..6, `openTime`/`closeTime` HH:mm) và `CreateSpecialClosingDto` (kiểm tra định dạng `YYYY-MM-DD`).
      - Service & Controller:
        - `GET /api/v1/restaurants/:id/schedule`: Lấy toàn bộ lịch 7 ngày và danh sách ngày nghỉ đặc biệt (từ ngày hôm nay trở đi).
        - `PUT /api/v1/restaurants/:id/schedule/weekly`: Cập nhật cấu hình 7 ngày (upsert hàng loạt).
        - `POST /api/v1/restaurants/:id/schedule/closings`: Thêm ngày nghỉ đặc biệt lễ/Tết.
        - `DELETE /api/v1/restaurants/:id/schedule/closings/:closingId`: Xóa ngày nghỉ đặc biệt.
        - Cập nhật `findOneWithMenu` để luôn trả kèm `openingHours` và `specialClosings`.
    - Mobile:
      - Tiện ích [openingHours.ts](file:///d:/food-delivery-system/mobile/src/utils/openingHours.ts): bổ sung `getTodayOpeningHour`, `getTodaySpecialClosing`, `DAY_OF_WEEK_NAMES` (`Chủ Nhật`, `Thứ Hai`...).
      - Component [OwnerScheduleSheet.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/owner/OwnerScheduleSheet.tsx): Dành cho chủ quán, chia 2 tab:
        - Tab 1 "Lịch tuần (7 ngày)": Cấu hình từng ngày trong tuần, nút switch "Đóng cửa cả ngày", ô điều chỉnh giờ mở/đóng với bước 15 phút, phát hiện khung mở xuyên đêm, và nút tiện ích **"Sao chép Thứ Hai cho cả tuần"**.
        - Tab 2 "Ngày nghỉ đặc biệt": Thêm ngày nghỉ lễ/Tết/sửa chữa theo định dạng `YYYY-MM-DD` kèm lý do tùy chọn, xem danh sách ngày nghỉ đã lên lịch và nút xóa ngày nghỉ.
      - Component [CustomerScheduleSheet.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/restaurant/CustomerScheduleSheet.tsx): Dành cho khách hàng xem lịch tuần chi tiết, highlight ngày hiện tại kèm badge "Hôm nay", hiển thị banner cảnh báo nếu quán đang trong ngày nghỉ đặc biệt.
      - Màn hình [OwnerRestaurantScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/owner/OwnerRestaurantScreen.tsx): Bổ sung nút mở cài đặt lịch mở cửa và hiển thị tóm tắt.
      - Màn hình [RestaurantDetailScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/restaurant/RestaurantDetailScreen.tsx): Bổ sung liên kết mở bảng chi tiết giờ mở cửa và ngày nghỉ cho thực khách.
      - Kiểm thử: 16 unit tests backend (`opening-hours.spec.ts` & `restaurants-schedule.spec.ts`), 69 tests mobile, 0 lỗi TypeScript, build thành công 100%.
  - **Nhận xét cải tiến & Đề xuất phát triển thêm:**
    - *Nhiều ca trong ngày (Split Shifts):* Đối với các quán ăn trưa và ăn tối (VD: nghỉ ca chiều 14:00 - 17:00), trong tương lai có thể mở rộng bảng `RestaurantOpeningHour` để hỗ trợ 2 khung giờ trong cùng 1 ngày (VD: Ca 1: `09:00 - 14:00`, Ca 2: `17:00 - 22:00`).
    - *Lịch nghỉ định kỳ hàng năm / Lịch âm:* Hỗ trợ tự động tính các ngày lễ Tết âm lịch hàng năm (Mùng 1, 2, 3 Tết) để chủ quán không phải nhập thủ công mỗi năm.
    - *Bộ chọn lịch trực quan (Calendar Date Picker):* Bổ sung DatePicker dạng lịch tháng trực quan khi chọn ngày nghỉ đặc biệt để thao tác tiện lợi hơn trên màn hình cảm ứng nhỏ.

### 4.3 Chủ quán: chuông báo đơn mới (kèm push có âm thanh) ✅ (Đã hoàn thành 03/11/2026)
- **Đã triển khai:**
  - **Tệp âm thanh chuông báo:**
    - Tự tổng hợp file WAV 2 âm tần số kép (1046Hz và 1318Hz, decay ấm áp) tại [order_chime.wav](file:///d:/food-delivery-system/mobile/assets/sounds/order_chime.wav) (158KB, chuẩn PCM mono 44.1kHz), không dính bản quyền, tương thích tối đa trên iOS, Android và Web.
  - **Module phát âm thanh & rung chu kỳ ([orderAlertSound.ts](file:///d:/food-delivery-system/mobile/src/utils/orderAlertSound.ts)):**
    - Cấu hình âm thanh hệ thống qua `expo-av` với `playsInSilentModeIOS: true`, `staysActiveInBackground: true`, `shouldDuckAndroid: true` để chuông có thể phát ngay cả khi gạt nút im lặng trên điện thoại.
    - Rung máy lặp chu kỳ theo nhịp dồn `[0, 500, 300, 500, 2000]` qua `Vibration` của React Native.
    - Quản lý lặp chuông mỗi 3.5s và tự động dừng sau tối đa 2 phút (`autoStopSeconds: 120`) theo đúng chuẩn nghiệp vụ app giao đồ ăn (GrabFood, ShopeeFood).
    - Cung cấp các hàm điều khiển: `startOrderAlert`, `stopOrderAlert`, `playChimeOnce` (thử chuông), `isOrderAlertPlaying`.
  - **Store lưu trữ cấu hình chủ quán ([useOwnerSettingsStore.ts](file:///d:/food-delivery-system/mobile/src/store/useOwnerSettingsStore.ts)):**
    - Quản lý các biến cờ: `soundEnabled` (mặc định bật), `vibrationEnabled` (mặc định bật), `autoStopSeconds: 120`.
    - Tự động lưu và đồng bộ xuống bộ nhớ thiết bị qua `appStorage` (AsyncStorage).
  - **Modal cảnh báo đơn mới toàn cục ([NewOrderAlertModal.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/owner/NewOrderAlertModal.tsx)):**
    - Được gắn tại gốc ứng dụng trong [App.tsx](file:///d:/food-delivery-system/mobile/App.tsx) để hoạt động trên mọi màn hình của chủ quán (kể cả khi đang xem Thực đơn, Thống kê, Tin nhắn hay Cửa hàng).
    - Tự động bắt sự kiện Socket realtime `order:created` và `order:payment` khi đơn có trạng thái `PENDING`.
    - Hiển thị pop-up chuyên nghiệp: biểu tượng chuông cam nổi bật, mã đơn hàng dạng mono `#XXXXXX`, giá trị đơn định dạng VNĐ, đếm ngược tự động `MM:ss` ("Chuông tự tắt sau: 1:59").
    - Hai nút thao tác nhanh: **"Xem & Nhận đơn ngay"** (tự ngắt chuông và chuyển thẳng tới màn hình Đơn hàng) và **"Tắt chuông báo"** (tắt âm thanh và rung ngay lập tức).
  - **Giao diện cài đặt âm thanh ([OwnerRestaurantScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/owner/OwnerRestaurantScreen.tsx)):**
    - Thêm nhóm "Âm thanh & Chuông báo đơn" với 2 switch gạt: *"Chuông báo có đơn mới"* và *"Rung khi có đơn mới"*.
    - Bổ sung nút bấm *"Thử chuông"* để chủ quán nghe thử âm lượng trực tiếp.
  - **Kênh thông báo Android riêng (Android Notification Channel):**
    - [usePushNotifications.native.ts](file:///d:/food-delivery-system/mobile/src/hooks/usePushNotifications.native.ts): Đăng ký kênh `order_alerts` ("Chuông báo đơn mới (Chủ quán)") với độ ưu tiên `AndroidImportance.MAX`, chế độ rung dồn và hiển thị màn hình khóa (`lockscreenVisibility: PUBLIC`).
  - **Backend - Realtime & Push thông báo:**
    - [orders.gateway.ts](file:///d:/food-delivery-system/backend/src/modules/realtime/orders.gateway.ts): Bổ sung `total`, `restaurantId`, `restaurantName`, `itemCount` vào payload sự kiện `order:created` để mobile hiển thị ngay không cần chờ query API.
    - [notifications.service.ts](file:///d:/food-delivery-system/backend/src/modules/notifications/notifications.service.ts): Gửi push `order_alerts` với `priority: 'high'` khi có đơn mới và đơn nhắc nhở.
  - **Backend - Cron nhắc nhở đơn chờ ([order-jobs.service.ts](file:///d:/food-delivery-system/backend/src/modules/jobs/order-jobs.service.ts)):**
    - Thêm cron `handlePendingOrderReminders` chạy mỗi phút với khóa phân tán `LOCK_PENDING_REMINDER`.
    - Cấu hình biến môi trường `ORDER_PENDING_REMINDER_MINUTES` (mặc định 2 phút) trong [configuration.ts](file:///d:/food-delivery-system/backend/src/config/configuration.ts) và [.env.example](file:///d:/food-delivery-system/.env.example).
    - Tự động quét các đơn PENDING từ 2 đến 5 phút chưa được quán xác nhận, gửi push nhắc nhở khẩn cấp: *"⚠️ Đơn hàng mới chưa xác nhận! Đơn #XXXXXX đang chờ quán xác nhận..."* và kiểm tra trùng lặp thông báo để không spam.
  - **Kiểm thử:**
    - Unit tests mobile: `orderAlertSound.spec.ts` (3 tests).
    - Unit tests backend: `order-jobs.service.spec.ts` (9 tests bao gồm 2 test cho cron nhắc nhở).
    - Đạt chuẩn 100%: 72 tests mobile, 265 tests backend pass, 0 lỗi TypeScript, 0 lỗi linting.
- **Nhận xét cải tiến & Đề xuất phát triển thêm:**
  - *Bộ sưu tập nhạc chuông tùy chọn:* Cho phép chủ quán chọn giữa nhiều kiểu chuông (chuông điện thoại, chuông cửa, tiếng chuông gió...) tùy sở thích.
  - *Mức âm lượng riêng trong app:* Hỗ trợ thanh trượt chỉnh âm lượng chuông độc lập với âm lượng media chung của điện thoại.
  - *Auto-accept (Tự động nhận đơn):* Đối với các quán ăn nhanh hoặc quán cà phê có quy trình chuẩn, có thể bổ sung tùy chọn "Tự động xác nhận đơn khi có đơn mới" để bỏ qua bước bấm thủ công.

### 4.4 Chủ quán: món bán theo khung giờ
- ✅ **Món bán theo khung giờ (`MenuItem.availableFrom`, `availableTo` - Đã hoàn thành 03/11/2026):**
  - **Đã triển khai:**
    - Schema & Migration: Bổ sung 2 cột `availableFrom VARCHAR(5)?` và `availableTo VARCHAR(5)?` cho bảng `menu_items` (migration `20261103144600_menu_item_time_slots`).
    - Backend:
      - Tiện ích [dish-availability.util.ts](file:///d:/food-delivery-system/backend/src/common/utils/dish-availability.util.ts) kiểm tra chuẩn múi giờ VN (UTC+7), hỗ trợ cả khung giờ trong ngày (VD: `06:00 – 10:30`) và khung giờ qua đêm (VD: `22:00 – 02:00`).
      - DTO: Cập nhật `CreateMenuItemDto` và `UpdateMenuItemDto` kiểm tra regex định dạng `HH:mm` (00:00 - 23:59) và transform chuẩn hoá chuỗi.
      - Báo giá đơn [order-pricing.service.ts](file:///d:/food-delivery-system/backend/src/modules/orders/order-pricing.service.ts): Tự động chặn đặt món khi ngoài khung giờ mở bán (trả lỗi `BadRequestException`: *"Món '{name}' chỉ bán trong khung giờ {availableFrom} – {availableTo}."*).
    - Mobile:
      - Tiện ích [dishAvailability.ts](file:///d:/food-delivery-system/mobile/src/utils/dishAvailability.ts) tính toán nhãn trạng thái ("Bán từ HH:mm", "Bán HH:mm – HH:mm", "Tạm hết").
      - [DishRow.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/restaurant/DishRow.tsx): Hiển thị nhãn thời gian trên ảnh và thông tin món, làm mờ nhẹ, ẩn nút thêm nhanh `+` khi ngoài khung giờ.
      - [DishOptionSheet.tsx](file:///d:/food-delivery-system/mobile/src/components/modules/restaurant/DishOptionSheet.tsx): Hiển thị banner khung giờ mở bán, cập nhật nút đặt hàng *"Chỉ bán HH:mm – HH:mm"* và vô hiệu hoá nút đặt khi ngoài khung giờ.
      - [OwnerMenuScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/owner/OwnerMenuScreen.tsx): Bổ sung giao diện thiết lập "Khung giờ mở bán" trong form tạo/sửa món: switch bật/tắt, 4 nút chọn nhanh khung giờ phổ biến (Sáng 06:00–10:30, Trưa 10:30–14:00, Tối 17:00–22:00, Đêm 22:00–02:00), 2 ô nhập tùy chỉnh `availableFrom` / `availableTo` (HH:mm), kèm huy hiệu hiển thị khung giờ trên từng thẻ món của chủ quán.
      - Kiểm thử: 23 unit tests backend và 61 tests mobile pass 100%, typecheck TypeScript 0 lỗi.
  - **Nhận xét cải tiến & Đề xuất phát triển thêm:**
    - *Lọc tìm kiếm theo giờ bán:* Ở màn hình tìm kiếm / trang chủ, có thể bổ sung bộ lọc "Món ăn đang phục vụ ngay bây giờ" để ưu tiên hiển thị các món đang trong khung giờ mở bán.
    - *Đăng ký thông báo mở bán:* Khách hàng thích một món điểm tâm sáng có thể bấm nút "Nhắc tôi khi mở bán" để nhận thông báo đẩy khi đến giờ mở bán mỗi ngày.

### 4.5 Tài xế
- Mục tiêu thu nhập trong ngày (tài xế tự đặt) + thanh tiến độ trên màn Tìm đơn; thống kê theo tuần.
- "Khu vực nhiều đơn": API trả lưới ô (geohash/ô vuông khoảng 1 km) đếm đơn 2 giờ gần đây trong bán kính; mobile vẽ vòng tròn màu trên bản đồ. Không lộ địa chỉ khách.

## 5. ĐỢT 4: Khách hàng
- **Tìm kiếm có lọc/sắp xếp:** khoảng cách, đánh giá, phí ship ước tính, đang mở cửa, có voucher/giảm giá; lọc làm ở backend (`restaurants.service` / search).
  > ✅ Đã làm (04/11/2026): `GET /restaurants/nearby` nhận thêm `sort` (relevance | distance | rating | popular), `minRating`,
  > `maxDistanceKm`, `maxDeliveryFee` (đổi ra khoảng cách tối đa bằng hàm thuần `maxDistanceForFee` vì phí ship tăng theo
  > khoảng cách), `hasPromo` (quán có mã của quán còn hiệu lực hoặc món đang giảm giá); mỗi quán trả `promoLabel`.
  > Mobile: thanh lọc nhanh + bảng "Sắp xếp & lọc", nhãn ưu đãi trên thẻ quán, tải thêm khi cuộn, nút xoá lọc.
  > File: `backend/src/modules/restaurants/search-filters.ts`, `mobile/src/components/modules/search/SearchFilterSheet.tsx`.
- **Đánh giá kèm ảnh** (tối đa 3 ảnh, lưu Cloudinary thư mục `reviews`); chủ quán/admin ẩn được ảnh không phù hợp.
  > ✅ Đã làm (04/11/2026): `Review.images` / `Review.hiddenImages` (migration `20261104150000_review_images`);
  > `POST /orders/:id/review` nhận `images` (data URI JPG/PNG/WEBP, tối đa 3; ảnh lỗi khi tải lên thì bỏ qua).
  > `GET /restaurants/:id/reviews` trả `breakdown` (số đánh giá theo sao), `photoCount`, `commentCount`, lọc `withPhotos`;
  > ảnh bị ẩn không hiện công khai. `POST /reviews/:id/images/hide` (bắt buộc lý do: IRRELEVANT | OFFENSIVE | PERSONAL_INFO | SPAM)
  > và `/unhide`, ghi AuditLog. Mobile: chọn/chụp ảnh ở màn Đánh giá, màn `RestaurantReviews` (tổng quan + lọc + tải thêm),
  > xem ảnh toàn màn hình, màn đánh giá của chủ quán có lọc "Có ảnh" và ẩn / hiện ảnh.
  > Còn có thể làm thêm: màn admin duyệt các ảnh chủ quán đã ẩn (hiện xem qua Nhật ký quản trị).
- ✅ **Chia sẻ quán/món:** `Share` API của RN + deep link `fooddelivery://restaurant/:id` (scheme đã có trong app.json); cấu hình linking của React Navigation.
  > Đã làm khác kế hoạch: chia sẻ link **https** `/s/r/:id`, `/s/d/:id` do backend trả trang HTML có thẻ Open Graph
  > (Zalo/Messenger không bấm được link `fooddelivery://`); trang có nút mở app + nút bản web khi có `WEB_APP_URL`.
  > Còn lại: Android App Links / iOS Universal Links (cần APK đã ký + tên miền) để link https mở thẳng app.
- **Quên mật khẩu bằng OTP email:**
  - Gmail SMTP qua `nodemailer`, biến `SMTP_*` trong `.env`. **Nếu thiếu cấu hình SMTP thì DỪNG và hỏi người dùng**, không tự bịa.
  - OTP 6 số, lưu dạng băm, hết hạn 10 phút, tối đa 5 lần nhập sai, giới hạn gửi lại 60 giây.
  - Phản hồi giống nhau dù email có tồn tại hay không (chống dò tài khoản). Đổi mật khẩu xong thì thu hồi refresh token cũ.
- **Đăng nhập Google** (`expo-auth-session`): cần Google OAuth Client ID. **Nếu chưa có thì dừng và hướng dẫn người dùng tạo**, không làm dở.

## 6. ĐỢT 5: Admin & vận hành
- ✅ Tổng quan nâng cao: biểu đồ doanh thu/đơn theo ngày (7/30 ngày), top quán, tỉ lệ huỷ theo lý do, đơn đang xử lý realtime.
- ✅ Xem nhật ký quản trị (AuditLog): lọc theo người làm, hành động, thời gian.
- **Hỗ trợ/khiếu nại & chatbot:** làm theo `docs/PROMPT_TRUNG_TAM_TRO_GIUP.md` (phần admin: soạn FAQ, hàng đợi phiếu hỗ trợ, xem hội thoại bot).
- ✅ Đối soát COD cho tài xế trong app admin (nếu chưa có màn): ghi nhận tài xế nộp tiền (`SETTLEMENT`), xem công nợ từng tài xế.
  > Đã có trong `DriverVerifySheet`; tab Hệ thống có lối tắt "Đối soát COD tài xế" kèm số tài xế gần/vượt hạn mức.
- ✅ Xuất CSV: doanh thu quán (chủ quán), đơn hàng (admin), theo khoảng ngày.
  > Đã làm: `GET /admin/export/orders`, `GET /restaurants/:id/export/revenue` (`?from&to` YYYY-MM-DD giờ VN, tối đa 366 ngày,
  > 50.000 đơn); UTF-8 có BOM, chặn "CSV injection"; mỗi lần xuất ghi AuditLog. Mobile: nút tải ở màn Điều hành đơn (admin) và
  > Thống kê (chủ quán), chọn nhanh 7 ngày / 30 ngày / tháng này / tháng trước; web tải file, điện thoại mở bảng chia sẻ.

## 7. ĐỢT 6: Kỹ thuật
- GitHub Actions: chạy `tsc` + `jest` + `eslint` cho backend và mobile khi push/PR (dùng service Postgres trong CI nếu test cần DB).
- Sentry gói free cho backend và mobile, chỉ bật khi có `SENTRY_DSN`; không gửi thông tin cá nhân.
- **Dark mode: KHÔNG tự làm.** Hỏi người dùng trước (đổi giao diện toàn app).

## 8. Đề xuất thêm (làm nếu người dùng đồng ý; ghi trong báo cáo cuối)
1. **Lý do huỷ phía khách + chính sách huỷ:** khách chỉ huỷ được khi PENDING (đã có); bổ sung chọn lý do, đếm khách huỷ nhiều để cảnh báo.
2. **Điểm thưởng / tích điểm:** mỗi đơn giao thành công cộng điểm, đổi điểm lấy voucher (dùng lại hệ thống voucher).
3. **Hoàn tiền cho đơn VNPay bị huỷ:** sandbox ghi nhận trạng thái "chờ hoàn tiền" để admin xử lý tay (không gọi API hoàn tiền thật).
4. **Chống lạm dụng:** giới hạn tạo đơn liên tiếp, giới hạn số lần nhập mã voucher sai, phát hiện tài khoản ảo dùng mã "khách mới".
5. **Ghi chú món và "món hết" theo thời gian thực:** quán bấm "hết món" thì báo ngay (socket) cho khách đang có món đó trong giỏ.
6. **Ước tính thời gian làm món theo quán:** thay hằng số 10 phút bằng trung bình thực tế CONFIRMED→READY của quán (30 ngày), có chặn trên/dưới; dùng trong `delivery-time.ts`.
7. **Tài xế từ chối đơn có lý do + thống kê tỉ lệ nhận đơn** (nền tảng cho điều phối công bằng).

## 9. Cách báo cáo sau mỗi đợt
- Câu đầu: đợt đã xong hay chưa, test bao nhiêu/bao nhiêu.
- Liệt kê chức năng theo vai trò, file chính (link markdown), migration đã thêm, việc người dùng cần làm (khởi động lại Expo, build lại Docker, điền khoá…).
- Ghi rõ phần chưa làm hoặc làm khác kế hoạch và lý do. Không commit.

## 10. Bổ sung nghiệp vụ sau khi rà soát (03/11/2026)
Các điểm dưới đây làm cho hệ thống sát thực tế hơn; áp dụng khi làm các chức năng tương ứng.

1. **Chính sách huỷ đơn** (đưa mục 8.1 lên bắt buộc, làm cùng Voucher): khách huỷ miễn phí khi PENDING; sau khi quán nhận thì
   chỉ huỷ qua hỗ trợ; bắt buộc chọn lý do; đếm khách huỷ nhiều để cảnh báo.
2. **Hoàn tiền VNPay** (đưa mục 8.3 lên bắt buộc): đơn đã thanh toán bị huỷ/giao thất bại → trạng thái "chờ hoàn tiền", admin xử lý
   tay; hoàn lượt voucher đi cùng luồng này.
3. **Chuông báo đơn mới khi app chạy nền**: âm thanh lặp chỉ chạy khi app đang mở; thêm push có **kênh thông báo Android âm thanh
   riêng** (độ ưu tiên cao) để quán nghe được cả khi tắt màn hình.
4. ✅ **Xoá tài khoản** (Google Play / App Store bắt buộc - Đã hoàn thành 03/11/2026):
   - **Đã triển khai:**
     - Backend: `DELETE /api/v1/users/me` xử lý an toàn trong transaction Prisma:
       - Rà soát điều kiện hợp lệ (`canDeleteUserAccount`): Chặn xoá nếu khách hàng có đơn đang xử lý (`PENDING`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`); chặn tài xế có đơn đang giao hoặc còn nợ COD (`codBalance > 0`); chặn chủ quán còn đơn chưa hoàn tất ở bất kỳ quán nào của họ.
       - Ẩn danh hóa dữ liệu cá nhân (chuẩn GDPR & Store Guidelines): `fullName: 'Tài khoản đã xoá'`, `email: deleted_<timestamp>_<shortId>@deleted.zomzom.local` (giải phóng email thật để có thể đăng ký lại sau này), `phone: null`, `avatarUrl: null`, xoá Expo Push Token & refresh token hash, khoá `isActive: false`.
       - Dọn dẹp quan hệ: Xoá địa chỉ đã lưu (`Address`), danh sách yêu thích (`Favorite`); nếu là chủ quán thì tự động chuyển các quán sang `isOpen: false, status: SUSPENDED`; nếu là tài xế thì set `isOnline: false`.
       - Bảo toàn lịch sử & đối soát: Giữ nguyên Order, PaymentTransaction, DriverDailyLedger, Review với liên kết `userId` để kế toán và đối soát dữ liệu không bị sai lệch.
       - Ghi vết bảo mật: Tạo bản ghi `AuditLog` với action `USER_DELETE_ACCOUNT`.
       - Hủy phiên tức thì: Gọi `AuthStateService.invalidate(userId)` để vô hiệu hóa token và session ngay lập tức.
     - Mobile: Màn hình [EditProfileScreen.tsx](file:///d:/food-delivery-system/mobile/src/screens/profile/EditProfileScreen.tsx) bổ sung mục "Vùng nguy hiểm: Xoá tài khoản" kèm hộp thoại xác nhận `ConfirmDialog` với cảnh báo rõ ràng, nút bấm màu đỏ nguy hiểm và tự động đăng xuất `logout()` khi hoàn tất.
     - Kiểm thử: 12/12 unit tests đạt chuẩn (`user-deletion.util.spec.ts` & `users.service.spec.ts`), mobile typecheck và test pass 100%.
   - **Nhận xét cải tiến & Đề xuất phát triển thêm:**
     - *Thời gian chờ huỷ (Grace period / Cooling-off 30 ngày):* Hiện tại xoá có hiệu lực ngay lập tức. Trong tương lai khi scale lớn, có thể hỗ trợ cơ chế "Chờ xoá" 30 ngày cho phép người dùng đổi ý đăng nhập lại để khôi phục tài khoản.
     - *Xác thực mật khẩu trước khi xoá (Re-authentication):* Để chống trường hợp người khác cầm điện thoại bấm xoá tài khoản trộm, có thể bổ sung bước nhập lại mật khẩu hiện tại trong modal xác nhận.
     - *Báo cáo quản trị (Admin oversight):* Bổ sung bộ lọc trong màn hình Admin Users để tra cứu nhanh danh sách các tài khoản đã tự xoá/ẩn danh khi cần đối chiếu khiếu nại tài chính.
5. **Đối soát & thanh toán cho quán**: bảng đối soát theo tuần (doanh thu món, khuyến mãi quán chịu, đơn huỷ, số tiền sàn phải trả),
   trạng thái "đã thanh toán" do admin đánh dấu; chủ quán xem và xuất CSV.
6. **Mô hình thu phí của sàn — cần người dùng quyết định**: hiện `platformCommission` = 20% **phí giao** (trừ vào thu nhập tài xế),
   sàn **không thu % trên tiền món** của quán. App thật thường thu quán 15–30% tiền món. Nếu đổi: thêm `commissionRate` theo quán,
   cột hoa hồng quán trên Order (chỉ THÊM cột), cập nhật báo cáo doanh thu/đối soát và công nợ COD của tài xế.
7. **Voucher — hạch toán rõ ràng**: hoa hồng (nếu có) tính trên tiền món SAU giảm khi quán chịu; voucher sàn chịu ghi nhận thành
   "chi phí khuyến mãi của sàn", báo cáo tách GMV / khuyến mãi / doanh thu thuần; quy tắc dùng chung **tối đa 1 mã quán + 1 mã
   freeship của sàn** mỗi đơn; công nợ COD tài xế = số tiền thực thu − thu nhập tài xế.
8. **Số điện thoại chưa xác minh**: đăng ký bắt buộc SĐT nhưng không có OTP SMS (tốn phí, bị cấm theo quy tắc 10) — ghi rõ là giới
   hạn của bản demo; giảm rủi ro bằng chặn tài khoản giao thất bại nhiều lần (đã có).
9. **Giới hạn tần suất** (mục 8.4): đăng nhập, gửi OTP, nhập mã voucher, tạo đơn liên tiếp.

10. ✅ **Trung tâm trợ giúp & Chatbot hỗ trợ - ĐỢT A: Dữ liệu & FAQ** (Đã hoàn thành 03/11/2026):
    - **Đã triển khai:**
      - Schema & Migration:
        - Thêm enums: `HelpAudience`, `SupportTicketStatus`, `SupportTicketPriority`, `SupportMessageRole`.
        - Thêm models: `HelpCategory`, `HelpArticle`, `HelpArticleFeedback`, `SupportTicket`, `SupportMessage`, `BotConversation`, `BotMessage`.
        - Migration: `20261103213000_help_center_and_support`.
      - Backend:
        - Thuật toán xếp hạng FAQ không dấu thuần `rankHelpArticles` (`backend/src/modules/help/help-ranking.util.ts`), kèm 6 unit tests pass 100%.
        - 16 bài FAQ mẫu chuẩn code hiện tại cho khách hàng (`help-seed.data.ts`), tự động nạp khi khởi động.
        - Service & Controller: `HelpService` và `HelpController` với đầy đủ CRUD, tìm kiếm, xem bài viết, đánh giá hữu ích 👍/👎 và bảo vệ quyền người dùng. 10 unit tests pass 100%.
      - Mobile:
        - Types & API: `HelpCategory`, `HelpArticle`, API client `mobile/src/api/help.ts`, hooks `useHelp.ts`.
        - Màn hình `HelpCenterScreen.tsx`: Header tìm kiếm động, danh sách 3 đơn hàng gần nhất để chọn hỗ trợ nhanh, lưới danh mục trợ giúp, danh sách câu hỏi phổ biến, thẻ truy cập Chatbot và Phiếu hỗ trợ của tôi.
        - Màn hình `HelpArticleScreen.tsx`: Xem chi tiết bài viết, nút bình chọn hữu ích (Có/Không) lưu lên server, gợi ý liên hệ hỗ trợ.
        - Điều hướng & Hồ sơ: Đã đăng ký `HelpCenter` và `HelpArticle` trong `RootStack.tsx` và thêm mục "Trung tâm trợ giúp" vào nhóm "Hỗ trợ" trên `ProfileScreen.tsx`.
      - Kiểm thử chất lượng:
        - Backend: 43 test suites, 281/281 tests pass. NestJS build code 0.
        - Mobile: 16 test suites, 72/72 tests pass. TypeScript typecheck 0 lỗi.
