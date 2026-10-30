# Prompt: Khảo sát, Rà soát toàn bộ Codebase & Xuất Báo cáo Luồng Nghiệp vụ Hiện tại của ZomZom

> **Hướng dẫn sử dụng:** Dán toàn bộ nội dung prompt này cho AI Coding Agent (Cursor, Claude Dev, Copilot Workspace, v.v.). Agent sẽ chỉ đọc, phân tích và xuất tài liệu Markdown, **tuyệt đối không chỉnh sửa mã nguồn hiện có**.

---

## 0. Nhiệm vụ chính

Bạn đóng vai trò là một **Senior Solution Architect / Lead Business Analyst**. Nhiệm vụ của bạn là:
1. Đọc và rà soát toàn bộ mã nguồn của dự án ZomZom (cả `backend/` NestJS và `mobile/` React Native/Expo).
2. Phân tích, bóc tách chính xác các luồng nghiệp vụ hiện tại đang hoạt động thực tế trong code (cái gì đã chạy thật, cái gì đang viết cứng/mock, cái gì chỉ có giao diện tĩnh).
3. Xuất kết quả phân tích thành một tệp tài liệu duy nhất đặt tại đường dẫn:
   👉 **`docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md`**

---

## 1. Phạm vi quét mã nguồn bắt buộc

Hãy quét kỹ các thư mục và tệp tin trọng yếu sau trước khi tổng hợp báo cáo:

### Phía Backend (`backend/`):
- **Cơ sở dữ liệu:** `prisma/schema.prisma` và `prisma/seed.ts` (xem toàn bộ bảng, cột, quan hệ, kiểu Enum và dữ liệu khởi tạo).
- **Trạng thái & Nghiệp vụ cốt lõi:**
  - `src/modules/orders/` (máy trạng thái `order-state-machine.ts`, tính giá `order-pricing.ts`, luồng đặt/hủy đơn).
  - `src/common/utils/` (`geo.util.ts`, `opening-hours.ts`, `vietnamese.ts`).
  - `src/modules/maps/` (các service tính khoảng cách, geocoding hiện có).
  - `src/modules/reviews/` (đánh giá quán ăn, schema bảng review).
  - `src/modules/realtime/` (Socket.IO gateways, các phòng room và sự kiện socket).
  - `src/modules/notifications/` (cơ chế gửi push notification).
  - `src/modules/auth/` & `src/modules/users/` (các vai trò, middleware phân quyền, guards, xử lý phiên).
  - `src/modules/restaurants/` & `src/modules/menus/` (quản lý món, giờ hoạt động, tồn kho).

### Phía Mobile App (`mobile/`):
- **Điều hướng & Màn hình chính:** `src/navigation/` (luồng Auth, Customer, Driver, Restaurant Owner).
- **Màn hình luồng đơn:** Màn giỏ hàng, checkout, tracking đơn hàng, lịch sử đơn.
- **Màn hình Chat & Cuộc gọi:** `src/screens/chat/ChatScreen.tsx` và các nút gọi điện (xem là UI tĩnh hay đã nối socket/API thật).
- **Màn hình Đánh giá:** Màn review sau giao hàng (hiện đang gửi những trường gì lên backend).
- **Màn hình Tài xế & Quán:** Màn nhận cuốc, danh sách đơn chờ, bật/tắt nhận đơn.

---

## 2. Cấu trúc tài liệu đầu ra yêu cầu (`docs/SO_DO_VA_LUONG_NGHIEP_VU_HIEN_TAI.md`)

Tệp Markdown được xuất ra phải tuân theo đúng cấu trúc đề mục dưới đây:

### Phần I: Bức Tranh Tổng Thể (System Architecture & Actor Matrix)
- Liệt kê toàn bộ các Actor (Vai trò) hiện có trong hệ thống và ma trận quyền hạn thực tế (Ai được làm gì dựa theo code `Guards` / `Roles`).
- Bảng danh mục các Module chức năng kèm đường dẫn file (`path`) chịu trách nhiệm chính.

### Phần II: Phân Tích Chi Tiết 7 Luồng Nghiệp Vụ Cốt Lõi
Đối với từng luồng nghiệp vụ dưới đây, hãy ghi rõ 3 mục con:
* **[Hiện trạng thực tế]:** Code đang viết như thế nào? Có gọi API/DB thật không? Đường dẫn file cụ thể?
* **[Mức độ hoàn thiện]:** Đánh giá phân loại theo 3 mức: `ĐÃ CHẠY THẬT` / `MOCK / VIẾT CỨNG (Hardcoded)` / `CHỈ CÓ GIAO DIỆN (UI Tĩnh)`.
* **[Khoảng trống nghiệp vụ (Gaps & Debt)]:** Những thiếu sót so với tiêu chuẩn của một app giao đồ ăn thực tế.

1. **Luồng Khách hàng tìm kiếm, chọn món & Tính giá (Discovery & Pricing Flow):**
   - Địa chỉ giao hàng được lấy từ đâu để tính khoảng cách (GPS hay địa chỉ lưu)?
   - Công thức tính khoảng cách và phí ship (đường chim bay hay đường bộ, hệ số phụ phí cao điểm ở đâu)?
   - Cách kiểm tra giờ đóng/mở cửa của quán và trạng thái còn/hết món.
2. **Luồng Vòng đời Đơn hàng & Máy trạng thái (Order State Machine Flow):**
   - Sơ đồ các bước chuyển trạng thái từ lúc bấm Đặt hàng đến khi Giao thành công / Hủy.
   - Bên nào được phép chuyển trạng thái nào? Điều kiện chuyển trạng thái?
   - Hiện tại có cơ chế Timeout hủy đơn nếu quán/tài xế không nhận không?
3. **Luồng Tài xế nhận cuốc & Vận hành (Driver Operations Flow):**
   - Tài xế tìm đơn theo cơ chế nào (bắn đơn, tự chọn trong danh sách, lọc theo bán kính)?
   - Quản lý trạng thái Online/Offline và vị trí GPS của tài xế.
4. **Luồng Thanh toán & Xử lý Dòng tiền (Payment & Money Flow):**
   - Hiện đang hỗ trợ những phương thức nào (COD, VNPay Sandbox...)?
   - Đơn COD đang xử lý ra sao? Đã có bảng theo dõi công nợ tài xế chưa?
5. **Luồng Đánh giá & Phản hồi (Rating & Review Flow):**
   - Bảng đánh giá hiện liên kết với những đối tượng nào (Quán, Món, Tài xế, Order)?
   - Chủ quán đã có màn hình xem và trả lời đánh giá chưa?
6. **Luồng Chat & Liên lạc (Communication Flow):**
   - Màn hình chat hiện đã nối API/Socket thật hay chỉ là state giả lập cục bộ?
   - Đã lưu tin nhắn vào DB chưa hay chỉ broadcast qua socket?
   - Nút gọi điện thoại đang thực hiện qua giao thức nào (`tel:` qua SIM hay qua tổng đài)?
7. **Luồng Quản trị & Điều hành (Admin & Operations Support Flow):**
   - Admin hiện can thiệp được những gì vào đơn hàng và tài khoản người dùng?
   - Đã có cơ chế ghi vết thao tác (Audit Log) cho các hành động nhạy cảm chưa?

### Phần III: Đánh Giá Rủi Ro & Đề Xuất Cải Tiến Trước Khi Nâng Cấp
- **Rủi ro dữ liệu:** Các điểm nghẽn nếu chạy `prisma migrate` (ví dụ bảng `reviews` thiếu khóa ngoại, thiếu quan hệ 1-1 với đơn).
- **Rủi ro hiệu năng & Chi phí:** Các điểm có thể làm spam API Maps hoặc tràn tải Socket.
- **Top 5 việc cấp bách cần làm ngay** để hệ thống sẵn sàng bước vào giai đoạn nâng cấp nghiệp vụ chuyên nghiệp.

---

## 3. Quy chuẩn làm việc của Agent

- **Tính khách quan:** Ghi nhận chính xác những gì đang có trong code, không đoán mò hoặc phóng đại những tính năng chưa viết xong. Nếu file chỉ có mockup UI, phải ghi rõ là UI tĩnh.
- **Đính kèm trích dẫn:** Mỗi nhận định về chức năng bắt buộc phải dẫn kèm đường dẫn file (`file path`) và dòng code tương ứng để người dùng kiểm chứng.
- **Không sửa mã nguồn:** Tuyệt đối không thay đổi bất kỳ file code nào trong thư mục `backend/` và `mobile/` trong lượt chạy này.