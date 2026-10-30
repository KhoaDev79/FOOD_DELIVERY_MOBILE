# Prompt: Hoàn thiện nghiệp vụ chuyên nghiệp cho app đặt đồ ăn ZomZom (Bản chuẩn thực tế v2)

> Dán toàn bộ tài liệu này cho AI Coding Agent / Trợ lý lập trình. Thực hiện theo từng giai đoạn; bắt buộc khảo sát mã nguồn hiện tại và chờ người dùng đồng ý kế hoạch trước khi chỉnh sửa mã nguồn (Mục 2).

---

## 0. Bối cảnh & Hiện trạng hệ thống

ZomZom là hệ thống đặt đồ ăn trực tuyến gồm hai thành phần:
- **Backend:** NestJS + Prisma ORM + PostgreSQL, đặt tại thư mục `backend/`.
- **App:** Expo / React Native + NativeWind, đặt tại thư mục `mobile/`.

**Vai trò hiện hành:** `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`, và Khách vãng lai (chưa đăng nhập).

**Nguyên tắc công nghệ & Tích hợp dịch vụ:**
- **Bản đồ & Khoảng cách:** Dự án đã có sẵn **Goong Map API Key**. Tuy nhiên, để tối ưu lượt gọi API (tránh tốn quota/chi phí phát sinh ngoài ý muốn) và đảm bảo tính sẵn sàng cao, hệ thống **bắt buộc triển khai theo kiến trúc Adapter kèm cơ chế Cache**:
  1. Ưu tiên lấy kết quả từ Cache toạ độ đã làm tròn (Grid/Geo-hash).
  2. Gọi Goong Distance Matrix API bằng API Key đã cấu hình trong biến môi trường (`GOONG_API_KEY`).
  3. Nếu API Goong gặp sự cố (timeout, hết hạn mức, lỗi mạng), tự động fallback sang tính toán đường chim bay (Haversine) × 1.3 và đánh dấu `distanceSource: "ESTIMATED"`.
- **Phương thức thanh toán:** Trọng tâm vận hành giai đoạn này là **COD (Tiền mặt khi nhận hàng)**. Cổng thanh toán trực tuyến (VNPay) chỉ thiết lập ở dạng Adapter/Interface giữ chỗ (mock/sandbox), chưa kích hoạt luồng thanh toán thực. Mọi rủi ro và xử lý dòng tiền tập trung vào luồng giao hàng thu tiền mặt, quản lý công nợ tài xế và xử lý sự cố boom hàng.
- **Lưu trữ tài nguyên (Media):** Lưu trữ trực tiếp vào thư mục máy chủ cục bộ `public/uploads` (phục vụ qua static files), không dùng dịch vụ Cloud trả phí (S3, Cloudinary).

**Tài liệu & Module cần dùng lại:**
- Bảng điều khiển trạng thái: `backend/src/modules/orders/order-state-machine.ts`
- Báo cáo quy tắc hiện hành: `docs/BAO_CAO_KIEM_TRA_NGHIEP_VU.md`
- Profile tài xế: `docs/PROMPT_APP_TAI_XE.md` (nếu đã triển khai thì tái sử dụng bảng `DriverProfile`, không tạo trùng).
- Socket.IO gateway: `modules/realtime/orders.gateway.ts` (phòng theo order và theo user).
- Định tuyến & Bản đồ: `modules/maps` (tận dụng lại các endpoint hiện có).

---

## 1. Quy tắc bắt buộc khi can thiệp mã nguồn

1. **Cơ sở dữ liệu (Database Migration):**
   - Chỉ thêm bảng, cột, quan hệ bằng lệnh: `npx prisma migrate dev --name <ten_migration_ro_nghia>`.
   - **Tuyệt đối cấm** chạy `prisma migrate reset`, `db push --force-reset` hoặc bất kỳ thao tác nào làm rớt bảng/mất dữ liệu cũ.
   - Trước mỗi migration, in ra lệnh `pg_dump` mẫu để người dùng tự sao lưu dữ liệu.
   - Đồng bộ dữ liệu mẫu trong `prisma/seed.ts` bằng phương thức `upsert` để có thể chạy lặp lại mà không sinh lỗi trùng lặp.
2. **Không tự ý cài đặt thư viện hoặc dịch vụ trả phí:**
   - Mọi kết nối dịch vụ bên ngoài phải thiết kế dạng **Adapter Pattern**: có cấu hình bật/tắt hoặc fallback cục bộ.
3. **Phòng thủ Backend (Defensive Backend):**
   - Mọi quy tắc nghiệp vụ, quyền hạn, tính toán tiền bạc phải được thẩm định tại Backend. Không tin cậy dữ liệu tính từ Client.
   - Thông báo lỗi trả về bằng Tiếng Việt thân thiện, rõ ràng. DTO sử dụng `class-validator` đầy đủ.
4. **Bảo toàn khả năng tương thích ngược (Backward Compatibility):**
   - Không xóa hoặc đổi kiểu dữ liệu các trường API cũ. Chỉ bổ sung trường mới để không làm gián đoạn các luồng đang chạy.
5. **Giao diện App (Mobile Client):**
   - Sử dụng NativeWind và tái sử dụng component tại `mobile/src/components/ui`.
   - Vùng cảm ứng tối thiểu 44pt, không sử dụng emoji trong chuỗi hiển thị nghiệp vụ, câu từ tiếng Việt chuẩn mực.

---

## 2. Quy trình thực hiện (Bắt buộc Khảo sát trước)

Trước khi viết hoặc sửa bất kỳ dòng mã nào, AI Agent phải thực hiện:
1. **Khảo sát hiện trạng:** Quét toàn bộ mã nguồn liên quan đến 7 nhóm chức năng tại Mục 3. Ghi rõ file nào đã có, file nào chỉ là UI mô phỏng, bảng DB nào còn thiếu cột.
2. **Lập kế hoạch chi tiết:** Trình bày danh sách file sẽ tạo mới, file sẽ sửa, schema Prisma sẽ thêm, và các trường hợp biên (edge cases).
3. **Chờ người dùng xác nhận:** Chỉ bắt đầu Giai đoạn 1 khi người dùng gửi thông điệp đồng ý triển khai.

---

## 3. Chi tiết các chức năng chuẩn nghiệp vụ cần hoàn thiện

### 3.1. Định tuyến khoảng cách (Goong Map) & Cơ chế báo giá (Quote Engine)
* **Khoảng cách thực tế & Cache:**
  - Tích hợp Goong Distance Matrix API qua cấu hình `GOONG_API_KEY`.
  - Thiết lập bộ nhớ đệm (Cache) theo cặp toạ độ làm tròn đến 3 chữ số thập phân (bán kính sai số ~100m) với TTL 24h.
  - Fallback tự động sang Haversine $	imes 1.3$ nếu API lỗi hoặc quá hạn mức; lưu `distanceSource: "GOONG" | "ESTIMATED"` vào đơn hàng.
* **Điểm neo toạ độ giao hàng:**
  - Địa chỉ giao hàng được chọn làm gốc tính khoảng cách cho toàn bộ màn hình (Trang chủ, Chi tiết quán, Báo giá). Không dùng GPS ngẫu nhiên của thiết bị để tính phí giao hàng.
* **Bảng cấu hình phí động (Admin quản lý trong DB):**
  - Cấu hình: Phí cơ bản (bao gồm N km đầu), phí mỗi km tiếp theo, phí tối thiểu/tối đa.
  - Phụ phí giờ cao điểm (theo khung giờ), phụ phí đêm khuya (22h - 6h), phụ phí thời tiết xấu (Admin bật thủ công kèm thời gian tự tắt).
* **API Báo giá (`POST /orders/quote`):**
  - Nhận `restaurantId`, `deliveryAddressId`, danh sách `items`.
  - Trả về: Tiền món, Phí giao hàng chi tiết, Các khoản phụ phí, Chiết khấu, Tổng tiền thanh toán, và `expiresAt` (thời hạn hiệu lực của báo giá, mặc định 10 phút).
  - Quy tắc làm tròn tiền: Toàn bộ phí sau khi áp dụng hệ số phải được làm tròn lên bội số của **1.000 VNĐ** (chuẩn tiền mặt Việt Nam).
  - Khi Client bấm đặt hàng (`POST /orders`), Backend so khớp lại giá. Nếu báo giá đã hết hạn hoặc giá có biến động, trả về lỗi `409 Conflict` kèm dữ liệu báo giá mới nhất để Client xác nhận.
* **Tách bạch thu nhập tài xế:**
  - Lưu rõ ràng trong đơn: Khách trả bao nhiêu phí ship, Tài xế nhận bao nhiêu từ phí ship (theo tỷ lệ hoặc mức sàn quy định).

### 3.2. Vận hành đơn COD & Kiểm soát công nợ tài xế
* **Quy trình đơn COD:**
  - Khách chọn "Thanh toán khi nhận hàng (COD)".
  - Luồng trạng thái: `PENDING` $ightarrow$ `CONFIRMED` $ightarrow$ `PREPARING` $ightarrow$ `READY_FOR_PICKUP` $ightarrow$ `ON_THE_WAY` $ightarrow$ `DELIVERED`.
* **Quản lý ví & Hạn mức công nợ tài xế (Driver COD Limit):**
  - Bảng `DriverBalance` / `DriverLedger`: Ghi nhận biến động dòng tiền của tài xế.
  - Khi hoàn thành đơn COD: Tài xế thu tiền mặt từ khách (`Tổng tiền đơn`), hệ thống ghi nhận công nợ (Tài xế nợ nền tảng = `Tiền món` + `Phí hoa hồng nền tảng`).
  - Thiết lập **Hạn mức công nợ tối đa** (ví dụ: 1.000.000 VNĐ). Nếu công nợ vượt hạn mức, hệ thống tạm dừng quyền nhận đơn COD mới cho đến khi được Admin đối soát hoặc tài xế nộp lại tiền mặt.
* **Xử lý đơn giao thất bại / Boom hàng (`DELIVERY_FAILED`):**
  - Khi tài xế đến nơi nhưng không liên lạc được với khách (sau tối thiểu 3 cuộc gọi và 10 phút chờ), tài xế gửi yêu cầu báo giao thất bại kèm lý do chuẩn hoá.
  - Đơn chuyển trạng thái `DELIVERY_FAILED`, lưu lại vết để quản trị viên kiểm tra. Quán vẫn được bảo vệ quyền lợi doanh thu đã chế biến theo chính sách nền tảng.

### 3.3. Đánh giá đa chiều (Quán, Món ăn, Tài xế)
* **Mô hình dữ liệu:**
  - Thêm `orderId` (Unique) vào bảng đánh giá hoặc tạo bảng `OrderReview` liên kết 1-1 với đơn hàng.
  - Đánh giá phân tách:
    1. **Quán ăn:** Số sao (1–5, bắt buộc), nhận xét chữ, thẻ đánh giá nhanh (Đóng gói cẩn thận, Món ăn nóng hổi, Đúng vị...).
    2. **Món ăn:** Số sao cho từng món lẻ trong đơn (tuỳ chọn).
    3. **Tài xế:** Số sao (1–5, tuỳ chọn), thẻ nhanh (Thân thiện, Giao nhanh, Chạy cẩn thận...).
* **Quy tắc nghiệm thu:**
  - Chỉ cho phép đánh giá đơn hàng đã hoàn tất (`DELIVERED`) trong vòng 7 ngày.
  - Cho phép khách hàng chỉnh sửa đánh giá trong vòng 24 giờ kể từ lúc tạo.
  - Khách đánh giá $\le 2$ sao bắt buộc phải chọn ít nhất 1 lý do cụ thể (Món nguội, Giao chậm, Đổ vỡ, Sai món...).
* **Phân quyền xem & Phản hồi:**
  - Khách: Xem danh sách đánh giá của quán (ẩn bớt thông tin người gửi: "Nguyễn V. A.").
  - Chủ quán: Xem thống kê phân bố sao, xem chi tiết và **được trả lời phản hồi 01 lần** (công khai bên dưới đánh giá).
  - Tài xế: Xem điểm đánh giá trung bình thật, số lượng cuốc đã được đánh giá, 10 lời nhận xét gần nhất.
  - Admin: Có thẩm quyền ẩn các đánh giá vi phạm tiêu chuẩn cộng đồng (tự động tính toán lại điểm trung bình sau khi ẩn).

### 3.4. Hệ thống Chat thời gian thực theo đơn hàng
* **Cấu trúc kênh chat (`OrderMessage`):**
  - Hỗ trợ 3 kênh riêng biệt: `CUSTOMER_DRIVER`, `CUSTOMER_RESTAURANT`, `RESTAURANT_DRIVER`.
  - Thuộc tính tin nhắn: `id`, `orderId`, `senderId`, `senderRole`, `channel`, `content`, `type` (TEXT, SYSTEM, QUICK_TEMPLATE), `createdAt`, `readAt`.
* **Vòng đời & Giới hạn kênh:**
  - Kênh chỉ mở khi đối tượng liên quan đã nhận đơn (ví dụ: Kênh với tài xế chỉ mở khi tài xế đã bấm nhận đơn).
  - Sau khi đơn chuyển sang `DELIVERED` hoặc `CANCELLED`, kênh tiếp tục duy trì trạng thái cho phép nhắn tin trong 60 phút, sau đó tự động chuyển sang chế độ **Chỉ đọc (Read-only)**.
  - Giới hạn tần suất (Rate limiting): Tối đa 10 tin/phút, độ dài tối đa 500 ký tự/tin để chống spam.
* **Đồng bộ thời gian thực & Lưu vết:**
  - Gửi nhận tức thì qua Socket.IO.
  - Tích hợp thông báo đẩy (Push Notification) khi đối phương đang không mở trực tiếp màn hình chat.
  - Tin nhắn lưu vĩnh viễn trên Database server, đảm bảo đổi thiết bị hoặc đăng nhập lại không bị mất.

### 3.5. Mở rộng vai trò quản trị & Phân quyền vận hành
* **Bổ sung vai trò nghiệp vụ:**
  - `RESTAURANT_STAFF`: Nhân viên quán ăn (do Chủ quán mời thông qua số điện thoại/email, chỉ gắn với 1 cơ sở cụ thể). Quyền hạn: Nhận đơn, từ chối đơn, báo món hoàn tất, chuyển trạng thái còn/hết món. Tuyệt đối **không** được xem báo cáo doanh thu, không được đổi giá món ăn.
  - `DISPATCHER`: Điều phối viên hệ thống. Quyền hạn: Theo dõi màn hình các đơn đang tìm tài xế, can thiệp gán tài xế thủ công hoặc gỡ tài xế khỏi đơn hàng gặp sự cố.
  - `SUPPORT`: Chăm sóc khách hàng. Quyền hạn: Đọc lịch sử chat của đơn hàng có khiếu nại, hỗ trợ hủy đơn kèm lý do bảo trợ, ghi nhận yêu cầu bồi hoàn.
* **Nhật ký hệ thống (Audit Log):**
  - Tạo bảng `AuditLog` lưu lại: `actorId`, `action`, `resourceType`, `resourceId`, `reason`, `ipAddress`, `createdAt`.
  - Bắt buộc ghi log khi: Hủy đơn hàng bất thường, Gán/gỡ tài xế bằng tay, Khóa tài khoản người dùng, Ẩn đánh giá, Sửa đổi biểu phí giao hàng.

### 3.6. Vận hành tự động & Tác vụ nền (Cron Jobs)
* **Tự động hủy đơn quán không tiếp nhận:**
  - Đơn hàng ở trạng thái chờ quán tiếp nhận quá $N$ phút (mặc định 5 phút - cấu hình động) mà quán không bấm nhận sẽ tự động chuyển sang `CANCELLED_BY_TIMEOUT`, gửi thông báo cho khách.
* **Cảnh báo đơn ứ đọng:**
  - Món đã chế biến xong (`READY_FOR_PICKUP`) quá $M$ phút (mặc định 10 phút) mà chưa có tài xế tiếp nhận sẽ tự động kích hoạt cờ cảnh báo trên màn hình của `DISPATCHER`.
* **Cơ chế khóa tài khoản tức thời:**
  - Thu hồi token hoặc kiểm tra trạng thái kích hoạt của người dùng ở mỗi request quan trọng (thông qua cache Redis/In-memory ngắn 30s). Tài khoản khi bị Admin khóa sẽ bị ngắt quyền lập tức thay vì đợi JWT hết hạn.

### 3.7. Tìm kiếm tiếng Việt thông minh & Quản lý Media cục bộ
* **Tìm kiếm:**
  - Sắp xếp kết quả tìm kiếm theo độ ưu tiên: Khớp chính xác có dấu $ightarrow$ Khớp không dấu $ightarrow$ Ưu tiên tên quán/tên món trước mô tả.
  - Hỗ trợ lưu lịch sử tìm kiếm gần nhất và gợi ý từ khóa phổ biến.
* **Tải lên hình ảnh (Media Upload Service):**
  - Xây dựng API `POST /upload/image`: Kiểm tra định dạng (JPEG, PNG, WEBP), giới hạn dung lượng ($\le 5	ext{MB}$), đổi tên file ngẫu nhiên chống trùng lặp (UUID) và lưu vào thư mục `public/uploads`.
  - Thay thế toàn bộ chuỗi Base64 đang lưu tạm trong cơ sở dữ liệu sang đường dẫn URL ảnh tĩnh.

---

## 4. Kế hoạch triển khai theo 6 giai đoạn

| Giai đoạn | Trọng tâm công việc | Giao phẩm kỹ thuật |
|---|---|---|
| **Giai đoạn 1** | Tích hợp Goong Map (Adapter + Cache) & Công cụ báo giá `Quote` | `MapsModule` cập nhật Goong API, bảng cấu hình biểu phí, API `/orders/quote`, đồng bộ toạ độ giao hàng ở Mobile. |
| **Giai đoạn 2** | Luồng vận hành COD, Hạn mức nợ tài xế & Xử lý sự cố boom hàng | Cập nhật luồng State Machine cho COD, bảng `DriverLedger`, cơ chế xử lý `DELIVERY_FAILED`. |
| **Giai đoạn 3** | Đánh giá toàn diện (Quán, Món, Tài xế) & Màn hình phản hồi | Migration bảng `OrderReview`, API đánh giá/phản hồi, UI màn hình đánh giá và màn hình quản lý đánh giá cho quán. |
| **Giai đoạn 4** | Hệ thống Chat thời gian thực theo đơn hàng & Socket.IO | Migration `OrderMessage`, Socket gateway, API lịch sử tin nhắn, giao diện chat phân kênh trên Mobile. |
| **Giai đoạn 5** | Mở rộng vai trò (`STAFF`, `DISPATCHER`, `SUPPORT`) & Audit Log | Bổ sung Enum vai trò, hệ thống phân quyền Guards/Decorators, bảng `AuditLog`, màn hình điều phối cho Dispatcher. |
| **Giai đoạn 6** | Tìm kiếm nâng cao, Media upload cục bộ & Tác vụ nền (Cron) | Tối ưu truy vấn tiếng Việt, API Upload ảnh lưu server, `@nestjs/schedule` xử lý timeout đơn hàng. |

---

## 5. Quy chuẩn kiểm thử & Báo cáo kết quả

- **Kiểm thử mã nguồn bắt buộc:**
  - Backend: `npx tsc --noEmit -p tsconfig.build.json`, chạy linter và kiểm thử đơn vị (`jest`) cho logic tính phí, phân quyền và máy trạng thái.
  - Mobile: `npx tsc --noEmit`, kiểm tra tương thích đóng gói web và iOS.
- **Biên bản bàn giao:**
  - Sau mỗi giai đoạn, cập nhật tiến độ vào file `docs/BAO_CAO_NGHIEP_VU_CHUYEN_NGHIEP.md` gồm: Thay đổi DB, danh sách API mới, kết quả kiểm thử thực tế và các lưu ý vận hành.