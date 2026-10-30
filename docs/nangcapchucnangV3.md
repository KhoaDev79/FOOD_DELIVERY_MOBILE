# Prompt: Kế hoạch Nâng cấp Nghiệp vụ Thực chiến ZomZom (Sprint v3 - COD 100%)

> Tài liệu này được thiết kế như một **Prompt thực thi kế thừa (Incremental Execution Prompt)** dành riêng cho AI Coding Agent.
> **Quy tắc bất di bất dịch:** KHÔNG viết đè hay sửa đổi các file prompt cũ (`PROMPT_NGHIEP_VU_CHUYEN_NGHIEP.md`, `PROMPT_NGHIEP_VU_CHUYEN_NGHIEP_V2.md`, `PROMPT_NGHIEP_VU_COD_THUAN_TUY.md`). Sử dụng tài liệu này như một chỉ dẫn bổ sung để khắc phục triệt để các lỗ hổng đã được chỉ ra trong báo cáo khảo sát `docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md`.

---

## 0. Bối cảnh & Mục tiêu tối thượng

Dựa trên kết quả rà soát thực tế từ mã nguồn (nhánh `redesign/nativewind-ui`):
- Hệ thống backend NestJS + PostgreSQL + Prisma và app Expo/React Native đã có khung sườn cơ bản.
- Tuy nhiên, dự án đang vấp phải **5 tử huyệt nghiệp vụ & kỹ thuật**:
  1. Hổng bảo mật nghiêm trọng: `RegisterDto` cho phép client tự gửi `role = RESTAURANT_OWNER` và tự tạo quán không cần phê duyệt.
  2. Toàn bộ tính năng theo dõi GPS tài xế thời gian thực bị tê liệt do app mobile không bao giờ gửi tọa độ lên.
  3. Thiếu hoàn toàn cơ chế hết hạn đơn (timeout cron job), dẫn đến đơn hàng kẹt vĩnh viễn ở trạng thái chờ.
  4. Lãng phí quota Goong Maps do thiếu cache tọa độ làm tròn; tính phí ship còn lệch pha giữa chim bay và đường bộ.
  5. Xuất hiện các thành phần giao diện "giả" (màn hình gọi điện fake `DriverCallScreen`, phản hồi chat tự động giả lập).

**Định hướng công nghệ cốt lõi trong Sprint này:**
- **Thanh toán:** Tập trung **100% vào luồng COD (Tiền mặt)**. Tạm thời đóng băng hoặc loại bỏ hoàn toàn các hook/guard kiểm tra VNPay `PAID` trước khi nhận đơn. Không làm cổng thanh toán online trong giai đoạn này.
- **Bản đồ:** Tận dụng **Goong Distance Matrix API Key** sẵn có trong biến môi trường, bắt buộc bọc qua Adapter có **Cache toạ độ làm tròn 3 chữ số thập phân (TTL 24h)** và fallback sang Haversine $	imes 1.3$ nếu API lỗi.
- **Lưu trữ:** Lưu ảnh đại diện / món ăn trực tiếp vào thư mục máy chủ cục bộ `public/uploads` (static serve), không dùng dịch vụ Cloud trả phí.

---

## 1. Nguyên tắc can thiệp mã nguồn

1. **Bảo toàn dữ liệu & Migration:**
   - Trước khi tạo migration mới, rà soát và commit các file migration chưa được theo dõi (`untracked files`).
   - Lệnh tạo migration duy nhất được phép dùng: `npx prisma migrate dev --name <ten_migration>`.
   - **Tuyệt đối cấm** chạy `prisma migrate reset` hoặc `db push --force-reset`.
   - Luôn cung cấp câu lệnh mẫu `pg_dump` trước khi tác động lên cấu trúc bảng.
2. **Nguyên tắc "Defensive Backend":**
   - Không tin tưởng bất kỳ giá trị nào do Client tính toán (đặc biệt là tiền hàng, phí ship, quyền hạn).
   - Mọi DTO đều phải được validate bằng `class-validator`.
   - Phản hồi lỗi phải trả bằng tiếng Việt rõ nghĩa, đúng mã HTTP (400, 401, 403, 404, 409).
3. **Tuân thủ UI NativeWind & Thiết kế sạch:**
   - Dùng các UI component sẵn có trong `mobile/src/components/ui`.
   - Vùng cảm ứng tối thiểu 44pt, không dùng emoji trong chuỗi text nghiệp vụ.
   - Thống nhất một tầng tiêu đề header, xóa sạch các nút nổi (FAB) đè nội dung.

---

## 2. Quy trình làm việc bắt buộc của Agent

1. **Bước 1: Khảo sát xác thực (Verification Step):**
   - Đọc kỹ `docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md`.
   - Kiểm tra các file liên quan trước khi sửa, liệt kê chính xác file sẽ tác động.
2. **Bước 2: Trình bày kế hoạch:**
   - Tóm tắt các endpoint API mới, các cột DB mới cần thêm, và giải pháp xử lý dữ liệu cũ.
3. **Bước 3: Chỉ thực thi khi người dùng xác nhận:**
   - Chờ người dùng phản hồi "Đồng ý" mới bắt đầu can thiệp mã nguồn.

---

## 3. Nội dung nâng cấp kỹ thuật chi tiết theo 5 trụ cột

### Trụ cột 1: Chốt chặn bảo mật, Phân quyền & Quản lý Quán ăn
* **Đóng lỗ hổng đăng ký:**
  - Trong `backend/src/modules/auth/dto/auth.dto.ts`, loại bỏ hoàn toàn thuộc tính `role` khỏi `RegisterDto`. Mọi tài khoản tạo mới mặc định nhận role `CUSTOMER`.
  - Nếu muốn trở thành Chủ quán hoặc Tài xế, người dùng phải gửi yêu cầu qua luồng `RoleUpgradeRequest` đã có sẵn.
* **Quy trình kiểm duyệt Quán ăn:**
  - Bổ sung trường `status` cho bảng `Restaurant` (Enum: `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`).
  - Khi chủ quán tạo quán mới qua `POST /restaurants`, trạng thái mặc định là `PENDING_APPROVAL`.
  - Quán chỉ hiển thị cho khách hàng đặt món trên Trang chủ/Tìm kiếm khi đã được Admin duyệt sang `ACTIVE`.
* **Tính năng Gán chủ quán (Dành cho Admin):**
  - Xây dựng API `PATCH /admin/restaurants/:id/assign-owner`: Cho phép Admin gán quyền quản lý một quán ăn bất kỳ (đặc biệt là 18 quán mẫu từ `seed.ts`) cho một User cụ thể.
  - Sau khi gán, tài khoản User đó được tự động nâng role lên `RESTAURANT_OWNER` nếu đang là `CUSTOMER`.
* **Thu hồi phiên tức thời:**
  - Kiểm tra trạng thái `isActive` của User trong `JwtStrategy` (có thể dùng bộ nhớ đệm In-memory LRU ngắn 30 giây để tránh query DB liên tục) nhằm vô hiệu hóa truy cập ngay khi Admin bấm "Khóa tài khoản".

### Trụ cột 2: Goong Maps, Điểm neo vị trí & Công cụ Báo giá (`Quote Engine`)
* **Thống nhất điểm neo tính khoảng cách:**
  - Mobile: Điểm giao hàng được chọn ở đầu Trang chủ ("Giao đến...") là gốc tọa độ duy nhất để lọc bán kính và tính phí ship toàn app.
  - Màn hình Checkout bắt buộc kế thừa địa chỉ này từ store chung (`useDeliveryAddressStore`).
* **Adapter Goong Maps & Cache:**
  - Cập nhật module `maps`: Sử dụng `GOONG_API_KEY` để gọi Goong Distance Matrix.
  - Làm tròn toạ độ điểm đi và điểm đến tới 3 chữ số thập phân (khoảng cách sai số ~100m) làm Cache Key với TTL 24 giờ.
  - Fallback tự động: Nếu gọi Goong bị lỗi/hết quota, tự chuyển sang Haversine $	imes 1.3$ và ghi nhận `distanceSource = "ESTIMATED"`.
* **Báo giá tập trung (`POST /orders/quote`):**
  - Xóa bỏ toàn bộ logic tự tính phí ở client (`mobile/src/utils/fee.ts`). Màn hình Checkout chỉ đọc dữ liệu từ API Báo giá của Backend.
  - Trả về chi tiết: Tiền món, Phí giao hàng đường bộ, Phụ phí (nếu có), Tổng tiền COD, và thời hạn báo giá `expiresAt` (10 phút).
  - Quy tắc làm tròn: Toàn bộ phí vận chuyển phải làm tròn lên hàng nghìn (**1.000 VNĐ**).
  - Khi Client bấm đặt đơn (`POST /orders`), Backend tính lại giá. Nếu báo giá hết hạn hoặc có sai lệch phí, trả về mã lỗi `409 Conflict` kèm dữ liệu báo giá mới nhất để Client xác nhận lại.

### Trụ cột 3: Vận hành COD, Quản lý công nợ & Xử lý Boom hàng
* **Luồng đơn COD thuần túy:**
  - Loại bỏ hoàn toàn điều kiện kiểm tra đơn VNPay `PAID` trước khi Quán bấm xác nhận đơn.
  - Máy trạng thái đơn: `PENDING` $ightarrow$ `CONFIRMED` $ightarrow$ `PREPARING` $ightarrow$ `READY_FOR_PICKUP` $ightarrow$ `PICKED_UP` $ightarrow$ `DELIVERED`.
* **Quản lý công nợ tài xế (`DriverLedger`):**
  - Tạo bảng `DriverLedger`: Ghi nhận biến động số dư/công nợ của tài xế.
  - Khi giao thành công đơn COD: Tài xế thu tiền mặt từ khách. Hệ thống ghi nhận công nợ (Tài xế nợ nền tảng = `Tiền món` + `Hoa hồng nền tảng`).
  - Thiết lập **Hạn mức nợ tối đa** (mặc định 1.000.000 VNĐ). Nếu công nợ vượt hạn mức, hệ thống tạm khóa quyền nhận đơn COD mới trên app tài xế.
* **Xử lý đơn giao thất bại (`DELIVERY_FAILED`):**
  - Bổ sung trạng thái `DELIVERY_FAILED` và các cột `cancelReason`, `cancelledBy` vào bảng `Order`.
  - Tài xế được phép báo giao thất bại (sau tối thiểu 3 cuộc gọi không bắt máy và chờ 10 phút tại điểm giao) kèm lý do chuẩn hóa.

### Trụ cột 4: Kích hoạt GPS thời gian thực & Bộ lọc đơn tài xế
* **Kích hoạt gửi vị trí từ Mobile:**
  - Trong app tài xế, sử dụng `Location.watchPositionAsync` khi bật trạng thái trực tuyến (`isOnline = true`).
  - Khi đang nhận đơn (`PICKED_UP` hoặc `READY_FOR_PICKUP`): Gửi sự kiện Socket `driver:location` mỗi 3–5 giây. Backend chỉ broadcast cho phòng của đơn hàng đó, không ghi DB liên tục.
  - Khi đang rảnh rỗi: Gửi REST `PATCH /drivers/me/location` mỗi 30–60 giây để cập nhật tọa độ phục vụ thuật toán tìm đơn quanh khu vực.
* **Bộ lọc đơn chờ nhận:**
  - `GET /orders/available`: Bổ sung điều kiện chỉ trả về các đơn có vị trí quán ăn nằm trong bán kính $X$ km (mặc định 3–5 km) tính từ vị trí cập nhật gần nhất của tài xế.
* **Làm mới Token cho Socket:**
  - Cập nhật `mobile/src/hooks/useSocket.ts`: Bổ sung cơ chế tự động lấy accessToken mới khi kết nối lại, tránh tình trạng socket bị ngắt vĩnh viễn sau 15 phút.

### Trụ cột 5: Tác vụ nền (Cron Jobs) & Dọn dẹp tính năng giả
* **Tích hợp `@nestjs/schedule`:**
  - Viết Cron Job định kỳ (quét mỗi 1 phút):
    - Đơn hàng ở trạng thái `PENDING` quá 5 phút mà quán không bấm nhận $ightarrow$ Tự động hủy (`CANCELLED_BY_TIMEOUT`), phát thông báo cho khách.
    - Đơn hàng ở trạng thái `READY_FOR_PICKUP` quá 10 phút mà chưa có tài xế nhận $ightarrow$ Kích hoạt cảnh báo đơn ứ đọng trên màn hình Admin/Điều phối.
* **Dọn dẹp tính năng giả lập (Fake UI):**
  - Gỡ bỏ màn hình gọi điện giả lập `DriverCallScreen`. Các nút gọi điện trên app chuyển sang dùng trực tiếp `Linking.openURL('tel:<so_dien_thoai>')`.
  - Tạm ẩn tính năng Chat tự động giả lập trên Mobile cho đến khi bảng `OrderMessage` và Socket chat theo `orderId` được triển khai hoàn chỉnh.
* **Đánh giá thực tế (`OrderReview`):**
  - Thêm cột `orderId` (Unique) vào bảng `Review` (chấp nhận nullable cho dữ liệu cũ để tránh lỗi migration).
  - Cho phép đánh giá Quán ăn (sao + nhận xét) và Tài xế.
  - Bổ sung API cho Chủ quán xem danh sách đánh giá của quán mình và gửi phản hồi công khai 01 lần.

---

## 4. Kế hoạch triển khai theo 4 Sprint tuần tự

| Sprint | Trọng tâm công việc | Giao phẩm kỹ thuật |
|---|---|---|
| **Sprint 1** | Vá bảo mật, Chốt Migration dở dang, Gán chủ quán | Commit 40 file untracked, khóa `RegisterDto`, thêm `status` cho Restaurant, API `assign-owner` cho Admin. |
| **Sprint 2** | Goong Maps Adapter, Cache, Báo giá `POST /orders/quote` | Module Maps có cache tọa độ, thống nhất điểm neo vị trí, API `/orders/quote`, xóa logic tính phí ở mobile. |
| **Sprint 3** | Vận hành COD, Công nợ `DriverLedger`, GPS Tài xế | State Machine loại bỏ VNPay, bảng `DriverLedger`, kích hoạt `watchPositionAsync` gửi GPS thời gian thực. |
| **Sprint 4** | Cron Job tự hủy đơn, Gỡ Fake UI, Nâng cấp Đánh giá | `@nestjs/schedule` tự hủy đơn sau 5 phút, gỡ `DriverCallScreen`, gắn `orderId` vào bảng Review. |

---

## 5. Tiêu chuẩn nghiệm thu & Kiểm tra

- **Backend:** Chạy pass `npx tsc --noEmit -p tsconfig.build.json`, linter sạch sẽ, máy trạng thái không vướng lỗi logic.
- **Mobile:** Chạy pass `npx tsc --noEmit`, đóng gói thử nghiệm thành công qua `npx expo export -p web` và `npx expo export -p ios`.
- **Báo cáo:** Ghi nhận mọi thay đổi, API mới và kết quả kiểm thử vào file `docs/BAO_CAO_NGHIEP_VU_CHUYEN_NGHIEP.md`.