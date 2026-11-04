# Phụ lục 04: Kiểm thử, Hướng dẫn Vận hành, Bảng Bằng chứng và Từ điển Thuật ngữ

> Tài liệu này thuộc bộ Tài liệu Hệ thống **ZomZom** — xem trang chính tại [docs/TAI_LIEU_HE_THONG.md](../TAI_LIEU_HE_THONG.md).
>
> **Cơ sở mã nguồn:**
> - 52 file kiểm thử đơn vị Backend (`backend/src/**/*.spec.ts`), 2 file E2E (`backend/test/*.e2e-spec.ts`), 16 file kiểm thử đơn vị Mobile (`mobile/src/**/*.spec.ts`).
> - Quy trình CI tại `.github/workflows/backend-ci.yml` và `.github/workflows/mobile-ci.yml`.
> - Cấu hình môi trường và Docker tại `docker-compose.yml`, `backend/Dockerfile`, `backend/docker-entrypoint.sh`, `backend/.env.example`, `mobile/.env.example`, `mobile/src/constants/config.ts`.

---

## Mục lục

1. [Chi tiết Kiểm thử Tự động và CI/CD](#1-chi-tiết-kiểm-thử-tự-động-và-cicd)
2. [Hướng dẫn Cấu hình Biến môi trường và Khởi chạy Hệ thống](#2-hướng-dẫn-cấu-hình-biến-môi-trường-và-khởi-chạy-hệ-thống)
3. [Bảng Đối chiếu Bằng chứng Mã nguồn (Evidence Table)](#3-bảng-đối-chiếu-bằng-chứng-mã-nguồn-evidence-table)
4. [Từ điển Thuật ngữ Nghiệp vụ & Kỹ thuật (Glossary)](#4-từ-điển-thuật-ngữ-nghiệp-vụ--kỹ-thuật-glossary)
5. [Tổng hợp và Đối chiếu các Tài liệu hiện có trong `docs/`](#5-tổng-hợp-và-đối-chiếu-các-tài-liệu-hiện-có-trong-docs)

---

## 1. Chi tiết Kiểm thử Tự động và CI/CD

### 1.1. Thống kê tổng quan bộ kiểm thử (70 file — 446 test cases)

| Phân hệ | Loại kiểm thử | Công cụ | Số file test | Tổng số test cases (`it`/`test`) | Lệnh chạy kiểm thử | Kết quả kiểm chứng |
|---|---|---|---|---|---|---|
| **Backend** (`backend/src/**/*.spec.ts`) | Unit & Integration Test | Jest `^30.0.0` + `@nestjs/testing` | **52 files** | **367 test cases** | `cd backend && npm test` | **Pass 100%** |
| **Backend** (`backend/test/*.e2e-spec.ts`) | End-to-End (E2E) Test | Jest + `supertest` | **2 files** | **7 test cases** | `cd backend && npm run test:e2e` | Yêu cầu DB PostgreSQL đang chạy |
| **Mobile** (`mobile/src/**/*.spec.ts`) | Unit & Store/API Test | Jest `^29.7.0` + `ts-jest` | **16 files** | **72 test cases** | `cd mobile && npm test` | **16/16 suites pass (72/72 tests)** |
| **Tổng cộng** | | | **70 files** | **446 test cases** | | |

### 1.2. Danh sách các cụm kiểm thử trọng tâm ở Backend (`52 files`)
- **Xác thực & Phiên (`auth/`)**: `auth.service.spec.ts`, `auth.controller.spec.ts`, `jwt.strategy.spec.ts`, `roles.guard.spec.ts` — kiểm thử đăng ký, đăng nhập sai 5 lần khóa tài khoản, xoay vòng refresh token, phát hiện dùng lại token cũ.
- **Đơn hàng, Báo giá & Máy trạng thái (`orders/`)**: `orders.service.spec.ts`, `orders.controller.spec.ts`, `order-state-machine.spec.ts`, `quote-token.util.spec.ts` — kiểm thử toàn bộ ma trận chuyển trạng thái của 4 vai trò, báo giá HMAC, chống đặt trùng `Idempotency-Key`, hoàn tiền và chờ 10 phút tại điểm giao.
- **Voucher & Khuyến mãi (`vouchers/`)**: `vouchers.service.spec.ts`, `vouchers.controller.spec.ts` — kiểm thử lưu ví voucher, điều kiện đơn tối thiểu, giới hạn lượt dùng mỗi người, chọn voucher tốt nhất (`findBestVoucher`) và voucher riêng của quán.
- **Trung tâm trợ giúp & Chatbot (`help/`)**: `help.service.spec.ts`, `support-chat.service.spec.ts`, `support-ticket.service.spec.ts` — kiểm thử tìm kiếm FAQ, trả lời tự động ZomBot (cả nhánh Gemini AI và nhánh Fallback kịch bản), tạo và đóng phiếu hỗ trợ.
- **Tài xế, Quán ăn, Thực đơn, Tìm kiếm (`drivers/`, `restaurants/`, `menus/`, `search/`)**: kiểm thử nhận đơn nguyên tử (`updateMany`), tìm kiếm không dấu, lọc khoảng cách Haversine, bật/tắt món ăn.
- **Bản đồ, Thanh toán, Xuất CSV, Cron Job (`maps/`, `payments/`, `exports/`, `jobs/`)**: kiểm thử fallback 3 tầng bản đồ, chữ ký VNPay HMAC-SHA512, chống CSV Injection và khóa tư vấn PostgreSQL `pg_try_advisory_lock`.

### 1.3. Danh sách 16 file kiểm thử ở Mobile (`mobile/src/**/*.spec.ts`)
1. `mobile/src/api/client.spec.ts` — Kiểm thử hàng đợi làm mới token (`failedQueue`) khi nhiều request bị `401` cùng lúc.
2. `mobile/src/store/useAuthStore.spec.ts` — Kiểm thử lưu trữ phiên đăng nhập, chuyển đổi vai trò (`switchRole`) và đăng xuất.
3. `mobile/src/store/useCartStore.spec.ts` — Kiểm thử thêm món kèm tùy chọn topping, cảnh báo khác quán, tính tổng tiền tạm tính.
4. `mobile/src/store/useFavoritesStore.spec.ts` — Kiểm thử cập nhật lạc quan (Optimistic toggle) và hoàn tác khi lỗi mạng.
5. `mobile/src/store/useFilterStore.spec.ts` — Kiểm thử bộ lọc danh mục, khoảng giá, sắp xếp.
6. `mobile/src/store/useAddressStore.spec.ts` — Kiểm thử chọn địa chỉ giao hàng và tọa độ GPS.
7. `mobile/src/store/useToastStore.spec.ts` — Kiểm thử hàng đợi hiển thị thông báo nổi.
8. `mobile/src/utils/format.spec.ts` — Kiểm thử định dạng tiền VNĐ, khoảng cách `km` và thời gian.
9. `mobile/src/utils/validation.spec.ts` — Kiểm thử biểu thức chính quy email, số điện thoại Việt Nam, mật khẩu.
10. `mobile/src/utils/order-status.spec.ts` — Kiểm thử ánh xạ nhãn tiếng Việt và màu sắc cho 9 trạng thái đơn hàng.
11. `mobile/src/hooks/useDebounce.spec.ts` — Kiểm thử độ trễ debounce từ khóa tìm kiếm.
12. `mobile/src/hooks/useOrderRealtime.spec.ts` — Kiểm thử lắng nghe sự kiện Socket.IO và làm mới cache React Query.
13. `mobile/src/components/ui/cn.spec.ts` — Kiểm thử gộp class Tailwind không xung đột.
14. `mobile/src/services/voucher.service.spec.ts` — Kiểm thử gọi API ví voucher và áp mã tốt nhất.
15. `mobile/src/services/help.service.spec.ts` — Kiểm thử gọi API FAQ, ZomBot và Ticket.
16. `mobile/src/navigation/role-routing.spec.ts` — Kiểm thử điều hướng đúng nhánh màn hình cho từng vai trò (`CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`).

### 1.4. Quy trình Tích hợp liên tục (GitHub Actions CI)
- **Backend CI (`.github/workflows/backend-ci.yml`)**:
  - Khởi tạo dịch vụ container `postgres:16-alpine` (cổng `5432`, DB `food_delivery_test`).
  - Các bước tự động: `npm ci` -> `npx prisma generate` -> `npx prisma migrate deploy` -> `npm run build` (kiểm tra kiểu TypeScript) -> `npm run lint` -> `npm test` -> `npm run test:e2e`.
- **Mobile CI (`.github/workflows/mobile-ci.yml`)**:
  - Chạy trên `ubuntu-latest` với Node.js `20`.
  - Các bước tự động: `npm ci` -> `npm run typecheck` (`tsc --noEmit`) -> `npm run lint` -> `npm test -- --ci`.

---

## 2. Hướng dẫn Cấu hình Biến môi trường và Khởi chạy Hệ thống

### 2.1. Yêu cầu môi trường tiên quyết (Prerequisites)
- **Node.js**: Phiên bản `>= 20.x` LTS (khớp với `backend/Dockerfile` dùng `node:20-alpine` và GitHub Actions CI).
- **Cơ sở dữ liệu**: **PostgreSQL 16** (có thể chạy qua **Docker Desktop** bằng `docker-compose.yml` hoặc cài đặt PostgreSQL trực tiếp trên máy).
- **Thiết bị chạy Mobile**:
  - Máy ảo Android (Android Studio Emulator) hoặc iOS Simulator (macOS).
  - Điện thoại thật cài ứng dụng **Expo Go** (kết nối cùng mạng Wi-Fi LAN với máy tính) hoặc trình duyệt Web (`npm run web`).

### 2.2. Bảng Biến môi trường Backend (`backend/.env.example` & `backend/src/config/configuration.ts`)

> **Lưu ý bảo mật**: Các giá trị dưới đây chỉ là **ví dụ giả lập** để minh họa định dạng. Tuyệt đối không đưa khóa thật vào tài liệu.

| Tên biến môi trường | Bắt buộc? | Ý nghĩa | Giá trị ví dụ (Giả lập) | Cách lấy khóa (nếu là dịch vụ ngoài) |
|---|---|---|---|---|
| `PORT` | Không (Mặc định `3000`) | Cổng lắng nghe HTTP & WebSocket của Backend | `3000` | Tự chọn cổng trống trên máy |
| `NODE_ENV` | Không (`development`) | Môi trường vận hành (`development`, `test`, `production`) | `development` | Cấu hình cục bộ |
| `DATABASE_URL` | **Bắt buộc** | Chuỗi kết nối PostgreSQL cho Prisma ORM | `postgresql://postgres:postgres@localhost:5432/food_delivery?schema=public` | Khớp với cấu hình trong `docker-compose.yml` |
| `JWT_ACCESS_SECRET` | **Bắt buộc** | Khóa bí mật ký Access Token (tối thiểu 32 ký tự) | `example_access_secret_at_least_32_chars_long` | Tự sinh bằng lệnh `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **Bắt buộc** | Khóa bí mật ký Refresh Token | `example_refresh_secret_at_least_32_chars_long` | Tự sinh bằng lệnh `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN` | Không (`15m`) | Thời gian sống của Access Token | `15m` | Cấu hình theo nhu cầu |
| `JWT_REFRESH_EXPIRES_IN` | Không (`7d`) | Thời gian sống của Refresh Token | `7d` | Cấu hình theo nhu cầu |
| `QUOTE_TOKEN_SECRET` | Không (Fallback JWT secret) | Khóa HMAC-SHA256 ký báo giá đơn hàng (`quoteToken`) | `example_quote_hmac_secret_key_for_dev` | Tự sinh chuỗi ngẫu nhiên |
| `CORS_ORIGINS` | Không (`*` ở dev) | Danh sách tên miền được phép gọi API (cách nhau dấu phẩy) | `http://localhost:8081,http://localhost:19006` | Điền URL của Expo Web / App |
| `GEMINI_API_KEY` | Tùy chọn (Có Fallback) | Khóa API Google Gemini cho trợ lý ảo ZomBot | `AIzaSyExampleFakeKeyForDocumentationOnly` | Lấy miễn phí tại Google AI Studio (`aistudio.google.com`); nếu bỏ trống ZomBot tự chạy chế độ Kịch bản thông minh |
| `GEMINI_MODEL` | Không (`gemini-2.5-flash`) | Tên mô hình Gemini sử dụng cho ZomBot | `gemini-2.5-flash` | Cấu hình tên model của Google Gemini |
| `TRACKASIA_API_KEY` | Tùy chọn (Có Fallback) | Khóa bản đồ & định vị TrackAsia (ưu tiên số 1) | `ta_example_fake_key_000000` | Đăng ký tại `track-asia.com`; nếu trống tự chuyển sang Goong / Nominatim |
| `GOONG_API_KEY` | Tùy chọn (Có Fallback) | Khóa bản đồ Goong.io (ưu tiên số 2) | `goong_example_fake_key_000000` | Đăng ký tại `goong.io`; nếu trống tự dùng OpenStreetMap Nominatim miễn phí |
| `VNPAY_TMN_CODE` | Tùy chọn (Có Sandbox) | Mã website định danh tại cổng thanh toán VNPay | `DEMOVNP1` | Đăng ký tài khoản Sandbox tại `sandbox.vnpayment.vn` |
| `VNPAY_HASH_SECRET` | Tùy chọn (Có Sandbox) | Chuỗi bí mật tạo chữ ký `vnp_SecureHash` (HMAC-SHA512) | `EXAMPLEVNPAYHASHSECRET0123456789` | Nhận qua email khi đăng ký VNPay Sandbox |
| `VNPAY_URL` | Không | URL cổng thanh toán VNPay Sandbox | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | Mặc định của VNPay Sandbox |
| `VNPAY_RETURN_URL` | Không | URL đón kết quả trả về sau khi thanh toán VNPay | `http://localhost:3000/api/v1/payments/vnpay/return` | Trỏ về địa chỉ Backend |
| `CLOUDINARY_CLOUD_NAME` | Tùy chọn (Có Fallback) | Tên Cloud lưu trữ ảnh trên Cloudinary | `demo-cloud-name` | Đăng ký miễn phí tại `cloudinary.com` |
| `CLOUDINARY_API_KEY` | Tùy chọn (Có Fallback) | API Key của Cloudinary | `123456789012345` | Lấy trong Dashboard Cloudinary |
| `CLOUDINARY_API_SECRET` | Tùy chọn (Có Fallback) | API Secret để ký `presign` upload ảnh | `example_cloudinary_secret` | Lấy trong Dashboard Cloudinary |
| `SENTRY_DSN` | Tùy chọn | Chuỗi kết nối giám sát lỗi thời gian thực Sentry | `https://examplePublicKey@o0.ingest.sentry.io/0` | Tạo project tại `sentry.io` (bỏ trống nếu không dùng) |

### 2.3. Bảng Biến môi trường Mobile (`mobile/.env.example` & `mobile/src/constants/config.ts`)

| Tên biến môi trường | Ý nghĩa | Giá trị ví dụ (Giả lập) | Ghi chú cấu hình thực tế |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Địa chỉ gốc của Backend REST API | `http://192.168.1.10:3000/api/v1` | Nếu để trống, `mobile/src/constants/config.ts#L15-L52` sẽ tự động dò IP mạng LAN từ `Constants.expoConfig.hostUri` |
| `EXPO_PUBLIC_WS_URL` | Địa chỉ kết nối Socket.IO | `http://192.168.1.10:3000` | Tự động suy ra từ `EXPO_PUBLIC_API_URL` nếu không khai báo riêng |
| `EXPO_PUBLIC_TRACKASIA_KEY` | Khóa hiển thị style bản đồ vector trên App | `public_key` | Dùng bản đồ miễn phí nếu để mặc định |

### 2.4. Trình tự khởi chạy hệ thống chuẩn

#### Cách 1: Chạy toàn bộ Backend + PostgreSQL bằng Docker Compose
```bash
# Tại thư mục gốc d:\food-delivery-system
docker compose up -d --build
```
- Container `postgres` khởi chạy ở cổng `5432` (có `healthcheck` bằng `pg_isready`).
- Container `backend` chờ `postgres` sẵn sàng, tự động thực thi `backend/docker-entrypoint.sh`: chạy `npx prisma migrate deploy`, kiểm tra nếu bảng `User` đang trống (`count === 0`) thì tự động chạy `npx prisma db seed`, sau đó khởi động server tại `http://localhost:3000`.

#### Cách 2: Chạy thủ công phục vụ phát triển (Development Mode)
1. **Bước 1 — Khởi động PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```
2. **Bước 2 — Cài đặt, Migrate, Seed và chạy Backend**:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   npm run start:dev
   ```
3. **Bước 3 — Khởi chạy ứng dụng Mobile (Expo)**:
   ```bash
   cd mobile
   cp .env.example .env
   npm install
   npx expo start -c
   ```
   - Nhấn `a` để mở trên Android Emulator, `w` để mở trên trình duyệt Web, hoặc dùng camera/Expo Go quét mã QR trên điện thoại thật.

### 2.5. Cách kết nối từ Điện thoại thật qua mạng LAN và Xử lý lỗi thường gặp
- **Tự động nhận diện IP LAN**: Trong `mobile/src/constants/config.ts#L18-L48`, ứng dụng đọc `Constants.expoConfig?.hostUri` do Metro Bundler cấp (ví dụ `192.168.1.15:8081`), tách lấy địa chỉ IPv4 `192.168.1.15` và tự động ghép thành `http://192.168.1.15:3000/api/v1`. Nhờ đó khi đổi mạng Wi-Fi không cần sửa cứng IP trong code.
- **Các lỗi thường gặp và cách xử lý**:
  1. *Điện thoại thật báo `Network Error` dù máy tính vẫn vào được `localhost:3000`*: Do tường lửa Windows (Windows Defender Firewall) chặn cổng `3000` hoặc điện thoại với laptop khác lớp mạng Wi-Fi. Cách khắc phục: Mở cổng `3000` Inbound trên Windows Firewall hoặc chạy `npx expo start --tunnel`.
  2. *Máy ảo Android không gọi được `localhost:3000`*: Trên Android Emulator, `localhost` là chính máy ảo; `config.ts#L38` đã tự động ánh xạ sang `http://10.0.2.2:3000/api/v1`.
  3. *Lỗi `EPERM` hoặc cache Metro cũ trên Windows*: Chạy `npx expo start -c` để xóa cache bundler.

---

## 3. Bảng Đối chiếu Bằng chứng Mã nguồn (Evidence Table)

Bảng này giúp người làm báo cáo và slide tra cứu nhanh **"Nhận định nào nằm ở file nào, dòng bao nhiêu"**:

| STT | Nhận định / Tính năng trong báo cáo | File bằng chứng chính | Dòng tham chiếu |
|---|---|---|---|
| 1 | Tiền tố API `/api/v1`, bật ValidationPipe (`whitelist`, `forbidNonWhitelisted`) và Swagger `/docs` | `backend/src/main.ts` | `#L45-L95` |
| 2 | Cấu hình bảo mật toàn cục: `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard` | `backend/src/app.module.ts` | `#L65-L82` |
| 3 | Chuẩn hóa phản hồi thành công `{ success: true, data, meta }` | `backend/src/common/interceptors/transform.interceptor.ts` | `#L15-L42` |
| 4 | Bộ lọc lỗi toàn cục ẩn stack trace ở production và chuẩn hóa mã lỗi | `backend/src/common/filters/all-exceptions.filter.ts` | `#L20-L95` |
| 5 | Băm mật khẩu Argon2id, khóa tài khoản 15 phút khi sai 5 lần, xoay vòng Refresh Token | `backend/src/auth/auth.service.ts` | `#L48-L215` |
| 6 | Máy trạng thái đơn hàng 9 trạng thái và phân quyền chuyển trạng thái theo 4 vai trò | `backend/src/orders/order-state-machine.ts` | `#L1-L112` |
| 7 | Tính tiền ở server, ký `quoteToken` HMAC-SHA256, chống đặt trùng `Idempotency-Key`, khóa `SELECT FOR UPDATE` | `backend/src/orders/orders.service.ts` | `#L118-L415` |
| 8 | Tài xế nhận đơn nguyên tử (`updateMany` với `driverId: null`) chống tranh chấp | `backend/src/drivers/drivers.service.ts` | `#L165-L218` |
| 9 | Quy tắc tài xế phải chờ đủ 10 phút sau khi báo `driver-arrived` mới được báo giao thất bại | `backend/src/orders/orders.service.ts` | `#L520-L575` |
| 10 | Gateway Socket.IO xác thực JWT, phân phòng riêng tư và kiểm tra quyền sở hữu khi `order:join` | `backend/src/realtime/orders.gateway.ts` | `#L45-L176` |
| 11 | Dịch vụ bản đồ 3 tầng dự phòng (TrackAsia -> Goong -> OpenStreetMap Nominatim) kèm LRU Cache | `backend/src/maps/maps.service.ts` | `#L22-L185` |
| 12 | Tích hợp thanh toán VNPay HMAC-SHA512 và đối soát IPN/Return | `backend/src/payments/payments.service.ts` | `#L40-L165` |
| 13 | Hệ thống Voucher 2 cấp (Toàn sàn & Quán ăn) và thuật toán chọn mã giảm nhiều nhất | `backend/src/vouchers/vouchers.service.ts` | `#L30-L245` |
| 14 | Trung tâm trợ giúp, Chatbot AI ZomBot (Gemini 2.5 Flash + RAG đơn hàng + Fallback kịch bản) & Ticket | `backend/src/help/support-chat.service.ts`, `backend/src/help/support-ticket.service.ts` | `#L75-L260` |
| 15 | Cron Job quét đơn treo mỗi phút dùng khóa phân tán `pg_try_advisory_lock` | `backend/src/jobs/order-lifecycle.job.ts` | `#L25-L120` |
| 16 | Hàng đợi làm mới token tự động (`failedQueue`) trên Mobile Axios Interceptor | `mobile/src/api/client.ts` | `#L52-L128` |
| 17 | Cây điều hướng phân tách theo 4 vai trò người dùng và tự động chuyển giao diện theo `activeRole` | `mobile/src/navigation/AppNavigator.tsx` | `#L40-L210` |
| 18 | Hệ thống Design Tokens chuẩn hóa màu sắc, cỡ chữ và khoảng cách | `mobile/src/theme/tokens.json` | `#L1-L135` |

---

## 4. Từ điển Thuật ngữ Nghiệp vụ & Kỹ thuật (Glossary)

| Thuật ngữ | Giải thích trong ngữ cảnh dự án ZomZom |
|---|---|
| **Modular Monolith** | Kiến trúc nguyên khối chia mô-đun: toàn bộ 23 module nghiệp vụ chạy trong một tiến trình NestJS duy nhất, dùng chung cơ sở dữ liệu PostgreSQL nhưng tách biệt rõ ranh giới Controller - Service - DTO |
| **RBAC (Role-Based Access Control)** | Phân quyền dựa trên vai trò (`CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`) thông qua decorator `@Roles()` và `RolesGuard` |
| **Ownership Check** | Kiểm tra quyền sở hữu tài nguyên ở tầng Service (ví dụ: Chủ quán A không thể sửa món ăn hoặc duyệt đơn hàng của Chủ quán B dù cùng có vai trò `RESTAURANT_OWNER`) |
| **`quoteToken`** | Chuỗi chữ ký số HMAC-SHA256 do server cấp khi báo giá giỏ hàng (có hiệu lực 10 phút), đảm bảo số tiền khách nhìn thấy lúc thanh toán khớp tuyệt đối với số tiền lúc tạo đơn |
| **`Idempotency-Key`** | Khóa định danh duy nhất cho mỗi thao tác đặt hàng do client sinh ra, giúp server nhận biết và trả về đơn hàng cũ nếu client gửi trùng request do lỗi mạng |
| **Price Snapshot** | Kỹ thuật chụp lại tên món, đơn giá và danh sách tùy chọn vào bảng `OrderItem` tại thời điểm đặt để bảo toàn lịch sử hóa đơn khi thực đơn thay đổi |
| **KYC (Know Your Customer)** | Quy trình xác minh hồ sơ tài xế (biển số xe, bằng lái, CCCD) bởi Quản trị viên (`DriverKycStatus`: `PENDING` -> `APPROVED` / `REJECTED`) trước khi cho phép nhận đơn |
| **POD (Proof of Delivery)** | Bằng chứng giao hàng bằng hình ảnh (`proofOfDeliveryImageUrl`) mà tài xế đính kèm khi xác nhận đã giao đồ ăn thành công |
| **Stalled Order (Đơn hàng bị treo)** | Đơn hàng nằm ở trạng thái chờ quá lâu (ví dụ quán không xác nhận hoặc không có tài xế nhận sau ngưỡng thời gian quy định), được `OrderLifecycleJob` phát hiện để cảnh báo hoặc xử lý |
| **ZomBot** | Trợ lý ảo hỗ trợ khách hàng trong ứng dụng, kết hợp mô hình ngôn ngữ lớn Google Gemini 2.5 Flash (có truy xuất ngữ cảnh đơn hàng thật) với bộ quy tắc trả lời tự động dự phòng |

---

## 5. Tổng hợp và Đối chiếu các Tài liệu hiện có trong `docs/`

Trong thư mục `docs/` của dự án hiện đã có sẵn các tài liệu thiết kế và báo cáo kiểm định theo từng giai đoạn. Dưới đây là bảng tóm tắt và kết quả đối chiếu với mã nguồn thực tế hiện tại:

| Đường dẫn file trong `docs/` | Nội dung tóm tắt | Đối chiếu với mã nguồn hiện tại |
|---|---|---|
| `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DB_DESIGN.md` | Tài liệu phác thảo kiến trúc, cơ sở dữ liệu và API từ giai đoạn khởi tạo dự án | Mã nguồn hiện tại đã mở rộng vượt xa bản phác thảo ban đầu (tăng lên **34 bảng**, **117 endpoints**, bổ sung Voucher 2 cấp, Help Center, ZomBot AI, Multi-device session) |
| `docs/ui-inventory/00-README.md` đến `06-shared-components-and-theme.md` | Bộ kiểm kê chi tiết giao diện trước và trong đợt tái thiết kế sang NativeWind (24 UI primitives, bảng màu Teal `#00BFA6`, cấu trúc màn hình theo 4 vai trò) | Hoàn toàn khớp với cấu trúc `mobile/src/theme/tokens.json` và `mobile/src/components/ui/`; số lượng màn hình thực tế hiện tại đã tăng lên **52 màn hình** (thêm cụm Voucher và Trung tâm trợ giúp) |
| `docs/redesign/01-benchmark-and-style-guide.md` đến `03-validation-report.md` | Quy chuẩn thiết kế đối sánh với các siêu ứng dụng giao đồ ăn (GrabFood, ShopeeFood) và báo cáo nghiệm thu giao diện | Đã được áp dụng vào 115 file `.tsx` sử dụng `className` của NativeWind |
| `docs/PROMPT_TRUNG_TAM_TRO_GIUP.md` | Đặc tả yêu cầu nghiệp vụ cho phân hệ Trung tâm trợ giúp, FAQ, Chatbot ZomBot và Phiếu hỗ trợ | Đã được hiện thực hóa đầy đủ 100% ở cả Backend (`backend/src/help/`) và 5 màn hình Mobile (`mobile/src/screens/help/` + `AdminSupportTicketsScreen.tsx`) |
| `docs/sprint1_report.md`, `docs/sprint2_report.md`, `docs/sprint3_report.md`, `docs/sprint4_report.md`, `docs/minhkhoa_3110.md` | Báo cáo tiến độ kỹ thuật qua 4 giai đoạn (Sprint 1 -> Sprint 4) và nhật ký rà soát tính năng ngày 31/10 | Là bằng chứng xác thực cho mô hình phát triển lặp tăng trưởng (Iterative & Incremental) được trình bày tại Mục 7 của tài liệu chính |

