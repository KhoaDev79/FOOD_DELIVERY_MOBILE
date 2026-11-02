# PROMPT: Nâng cấp chức năng ứng dụng giao đồ ăn ZomZom

> Dành cho AI lập trình (Claude Code…) làm việc trực tiếp trong repo `food-delivery-system`.
> Nên giao **từng đợt một** (ví dụ: "Thực hiện ĐỢT 1 trong docs/PROMPT_NANG_CAP_CHUC_NANG.md").
> Trung tâm trợ giúp / chatbot của khách có prompt riêng: `docs/PROMPT_TRUNG_TAM_TRO_GIUP.md`.

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

### 2.1 Chuyển toàn bộ ảnh sang Cloudinary
Hiện trạng:
- `users.avatarUrl` ghi file vào `public/uploads/avatars` trong `users.service.ts` (`uploadAvatar`).
- `restaurants.imageUrl` và `menu_items.imageUrl` nhận **data URI base64 lưu thẳng vào DB**; có món dài hơn 1 MB.
- Banner/danh mục và dữ liệu mẫu trỏ `/public/images/food/*.jpg`.

Việc cần làm:
- Đưa `ImageStorageService` thành **module dùng chung (Global)** `media`. Thư mục Cloudinary: `zomzom/{avatars|restaurants|dishes|banners|cuisines|reviews|support}`.
- Hàm `resolveImage(value, folder)`:
  - data URI → tải lên và trả link;
  - link `http(s)` hoặc `/public/...` → giữ nguyên;
  - chuỗi rỗng → `null`.
- Link trả về gắn transformation `f_auto,q_auto,c_limit,w_<theo loại>`: banner 1600, ảnh quán 1200, món 800, avatar/danh mục 400.
- Áp dụng `resolveImage` ở mọi chỗ ghi ảnh: tạo/sửa quán (owner và admin), tạo/sửa món, avatar (`uploadAvatar` tải buffer lên Cloudinary thay vì ghi đĩa), banner, danh mục.
- Kiểm tra ảnh: chỉ JPG/PNG/WebP, tối đa 5 MB (dùng `parseImageDataUri` sẵn có).
- Script `backend/scripts/migrate-images-to-cloudinary.ts`:
  - Duyệt users / restaurants / menu_items / banners / cuisine_categories.
  - Với giá trị data URI hoặc `/public/...`: tải lên (gộp trùng theo nội dung/đường dẫn để không tải lại cùng một ảnh) rồi cập nhật link.
  - Có chế độ `--dry-run` in thống kê; idempotent (chạy lại không tải lại ảnh đã là link Cloudinary).
- Seed vẫn dùng `/public/...` để chạy được khi offline; ghi trong README rằng sau khi seed thì chạy script chuyển ảnh.
- Mobile: các form ảnh (owner menu, owner restaurant, avatar) giữ cách gửi hiện tại; đảm bảo `AppImage` hiển thị đúng link Cloudinary.

### 2.2 Sẵn sàng deploy (không tốn phí)
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
- `Restaurant.pausedUntil` (nullable): nút "Tạm nghỉ 30 phút / 1 giờ / đến hết hôm nay"; hết giờ tự mở lại; hiển thị đếm ngược trên `StoreStatusCard`.
- Bảng `RestaurantOpeningHours` (restaurantId, dayOfWeek 0–6, openTime, closeTime, isClosed), hỗ trợ khung qua đêm.
  - Giữ `openTime`/`closeTime` cũ làm mặc định khi chưa cấu hình (tương thích ngược).
  - Thêm bảng ngày nghỉ đặc biệt (lễ, Tết) nếu hợp lý.
- Cập nhật `isWithinOpeningHours` / `isAcceptingOrders` (backend) và `getStoreStatus` (mobile) dùng **chung một quy tắc** + test (qua đêm, ngày nghỉ, đang tạm nghỉ).
- Màn sửa giờ mở cửa theo 7 ngày (có nút "áp dụng cho tất cả các ngày").

### 4.3 Chủ quán: chuông báo đơn mới
- Khi có `order:created` ở trạng thái PENDING: phát âm thanh lặp lại (dùng `expo-audio`/`expo-av` bản tương thích SDK 58, cài bằng `npx expo install`) cho tới khi chủ quán nhận/từ chối, hoặc tối đa 2 phút; rung máy.
- Công tắc bật/tắt chuông trong màn Cửa hàng. File âm thanh đặt trong `mobile/assets/sounds/` (tự tạo file WAV ngắn, không dùng file có bản quyền).
- Cron backend: đơn PENDING quá N phút gửi push nhắc quán (N trong config).

### 4.4 Chủ quán: món bán theo khung giờ
- Món có `availableFrom`/`availableTo` (nullable); ngoài khung giờ thì hiện "Bán từ 6:00" và không đặt được (kiểm tra cả ở báo giá).

### 4.5 Tài xế
- Mục tiêu thu nhập trong ngày (tài xế tự đặt) + thanh tiến độ trên màn Tìm đơn; thống kê theo tuần.
- "Khu vực nhiều đơn": API trả lưới ô (geohash/ô vuông khoảng 1 km) đếm đơn 2 giờ gần đây trong bán kính; mobile vẽ vòng tròn màu trên bản đồ. Không lộ địa chỉ khách.

## 5. ĐỢT 4: Khách hàng
- **Tìm kiếm có lọc/sắp xếp:** khoảng cách, đánh giá, phí ship ước tính, đang mở cửa, có voucher/giảm giá; lọc làm ở backend (`restaurants.service` / search).
- **Đánh giá kèm ảnh** (tối đa 3 ảnh, lưu Cloudinary thư mục `reviews`); chủ quán/admin ẩn được ảnh không phù hợp.
- **Chia sẻ quán/món:** `Share` API của RN + deep link `fooddelivery://restaurant/:id` (scheme đã có trong app.json); cấu hình linking của React Navigation.
- **Quên mật khẩu bằng OTP email:**
  - Gmail SMTP qua `nodemailer`, biến `SMTP_*` trong `.env`. **Nếu thiếu cấu hình SMTP thì DỪNG và hỏi người dùng**, không tự bịa.
  - OTP 6 số, lưu dạng băm, hết hạn 10 phút, tối đa 5 lần nhập sai, giới hạn gửi lại 60 giây.
  - Phản hồi giống nhau dù email có tồn tại hay không (chống dò tài khoản). Đổi mật khẩu xong thì thu hồi refresh token cũ.
- **Đăng nhập Google** (`expo-auth-session`): cần Google OAuth Client ID. **Nếu chưa có thì dừng và hướng dẫn người dùng tạo**, không làm dở.

## 6. ĐỢT 5: Admin & vận hành
- Tổng quan nâng cao: biểu đồ doanh thu/đơn theo ngày (7/30 ngày), top quán, tỉ lệ huỷ theo lý do, đơn đang xử lý realtime.
- Xem nhật ký quản trị (AuditLog): lọc theo người làm, hành động, thời gian.
- **Hỗ trợ/khiếu nại & chatbot:** làm theo `docs/PROMPT_TRUNG_TAM_TRO_GIUP.md` (phần admin: soạn FAQ, hàng đợi phiếu hỗ trợ, xem hội thoại bot).
- Đối soát COD cho tài xế trong app admin (nếu chưa có màn): ghi nhận tài xế nộp tiền (`SETTLEMENT`), xem công nợ từng tài xế.
- Xuất CSV: doanh thu quán (chủ quán), đơn hàng (admin), theo khoảng ngày.

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
