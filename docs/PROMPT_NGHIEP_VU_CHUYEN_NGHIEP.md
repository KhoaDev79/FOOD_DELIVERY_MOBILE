# Prompt: Hoàn thiện nghiệp vụ chuyên nghiệp cho app đặt đồ ăn ZomZom

> Dán toàn bộ phần dưới đây cho trợ lý lập trình. Làm theo từng giai đoạn; khảo sát trước và chờ mình đồng ý rồi mới sửa (mục 2).

---

## 0. Bối cảnh

ZomZom là app đặt đồ ăn gồm hai phần:

- **Backend:** NestJS + Prisma + PostgreSQL, ở `backend/`.
- **App:** Expo / React Native + NativeWind, ở `mobile/`.

Các vai trò hiện có: `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`, và khách vãng lai (chưa đăng nhập).

**Đọc trước khi làm:**

- `docs/BAO_CAO_KIEM_TRA_NGHIEP_VU.md`: các quy tắc nghiệp vụ hiện hành và những việc còn tồn đọng.
- `docs/PROMPT_APP_TAI_XE.md` và `docs/PROMPT_TRA_LOI_AGENT_TAI_XE.md`: app tài xế và hồ sơ tài xế (bảng `DriverProfile`, trực tuyến/ngoại tuyến). Nếu phần này **đã làm xong** thì dùng lại, không làm trùng. Nếu **chưa làm** thì làm phần đó trước giai đoạn 3 của prompt này.

**Những gì đã có, cần dùng lại:**

| Có sẵn | Ở đâu |
|---|---|
| Quy tắc chuyển trạng thái đơn | `backend/src/modules/orders/order-state-machine.ts` |
| Tính giá món | `order-pricing.ts` |
| Phí ship | `common/utils/geo.util.ts` (`calcDeliveryFee`, phụ phí giờ cao điểm 20% đang viết cứng) |
| Giờ mở cửa | `common/utils/opening-hours.ts` |
| Tìm kiếm không phân biệt dấu | `common/utils/vietnamese.ts` |
| Socket.IO, phòng theo đơn và theo người dùng | `modules/realtime/orders.gateway.ts` |
| Thông báo đẩy | `modules/notifications/notifications.service.ts` |
| API bản đồ (`reverse-geocode`, `autocomplete`, `place-detail`, `distance`) | `modules/maps` |
| Đánh giá quán | `POST /orders/:id/review`; bảng `reviews` **chưa có cột `orderId`** |
| Màn chat | `mobile/src/screens/chat/ChatScreen.tsx`, nhiều khả năng **chỉ là giao diện mô phỏng**, backend chưa có bảng tin nhắn. Hãy xác minh |
| Nút gọi điện | Mở trình gọi điện của máy (`tel:`), gọi bằng số thật qua SIM. **Giữ nguyên cách này, không làm che số hay tổng đài** |

---

## 1. Quy tắc bắt buộc cho mọi giai đoạn

1. **Cơ sở dữ liệu**
   - Được thêm bảng hoặc cột bằng `npx prisma migrate dev --name <ten_ro_rang>`.
   - **Cấm** `prisma migrate reset`, `db push --force-reset`, hoặc bất kỳ lệnh nào xoá dữ liệu. Migration báo cần reset thì dừng lại hỏi mình.
   - Trước mỗi migration, nhắc mình sao lưu (in ra lệnh `pg_dump` mẫu, không tự chạy).
   - Cập nhật `prisma/seed.ts` bằng dữ liệu giả hợp lý, chạy lại nhiều lần không lỗi (`upsert`).
2. **Không cài thư viện mới hay dịch vụ trả phí** khi chưa hỏi mình (ví dụ dịch vụ lưu trữ ảnh). Với các dịch vụ trả phí, làm theo kiểu **adapter**: có một bản "giả lập cho phát triển" miễn phí và một chỗ cắm nhà cung cấp thật qua biến môi trường.
3. **Backend tự kiểm tra mọi quy tắc và mọi quyền**, không tin app. Lỗi trả bằng tiếng Việt. Mọi DTO dùng class-validator.
4. **Không làm hỏng luồng đang chạy** của khách, quán, tài xế và admin. Response cũ chỉ được **thêm trường**, không bỏ hay đổi nghĩa trường.
5. **App:**
   - Dùng NativeWind và các component trong `mobile/src/components/ui` (`TabHeader`, `ConfirmDialog`, `BottomSheet`, `useToast`, `Button`, `ListRow`…).
   - `Animated.View` chỉ nhận một style hoạt hình (giới hạn trên iOS, xem báo cáo cũ).
   - Không truyền hàm qua tham số điều hướng.
   - Vùng chạm tối thiểu 44 điểm, có nhãn truy cập, chữ tiếng Việt đúng chính tả, không emoji.
6. **Mỗi tính năng:** có test cho phần tính toán và quy tắc; chạy kiểm tra kiểu, lint, test và đóng gói thử web và iOS.
7. **Dữ liệu cá nhân:** không lưu số căn cước, ảnh giấy tờ, nội dung thẻ ngân hàng.
8. **Gọi điện và đăng nhập giữ nguyên như hiện tại:** gọi bằng số thật qua SIM (`tel:`); đăng nhập bằng email và mật khẩu. **Không làm** che số điện thoại, tổng đài, gọi qua Internet hay đăng nhập bằng số điện thoại / OTP.

---

## 2. Bước khảo sát (chưa sửa code)

1. Xác minh hiện trạng từng mục ở mục 3: cái gì đã có, cái gì giả lập, cái gì thiếu. Ghi kèm đường dẫn file.
2. Lập kế hoạch theo các giai đoạn ở mục 4, ghi rõ migration nào, API nào, màn nào.
3. Liệt kê các việc **cần mình quyết định**, đặc biệt là các mục ảnh hưởng tới tiền ở mục 3.1 và 3.5.

**Chờ mình đồng ý rồi mới làm.**

---

## 3. Các chức năng cần có

### 3.1 Khoảng cách và phí giao hàng chuẩn thực tế

**Hiện trạng:**

- Khoảng cách tính theo đường chim bay.
- Khoảng cách hiển thị ở trang chủ và trang quán tính theo GPS, hoặc toạ độ mặc định trung tâm TP.HCM khi không có quyền vị trí, **không theo địa chỉ giao khách chọn**.
- Phí ship dùng cấu hình cố định; khung giờ cao điểm và mức 20% viết cứng.
- Ước tính phí ở app có thể lệch với số backend tính.

**Cần làm:**

- **Khoảng cách theo đường đi thật** từ API `/maps/distance` (Goong hoặc dịch vụ dự phòng). Có bộ nhớ đệm theo cặp toạ độ đã làm tròn. Nếu dịch vụ lỗi thì dùng đường chim bay × hệ số (ví dụ 1,3), và lưu vào đơn **cách tính đã dùng** (`distanceSource: ROAD | ESTIMATED`).
- **Địa chỉ giao đang chọn** là gốc tính mọi khoảng cách trong app: lưu ở một store dùng chung, hiện ở đầu trang chủ ("Giao đến…"). GPS chỉ dùng để gợi ý địa chỉ.
- **Bảng cấu hình phí do admin chỉnh**, thay cho giá trị viết cứng:
  - Phí cơ bản, số km miễn phí, phí mỗi km.
  - Phí tối thiểu và tối đa.
  - Các **khung giờ cao điểm** (giờ bắt đầu, giờ kết thúc, hệ số).
  - **Phụ phí đêm khuya**.
  - Công tắc **"phụ phí thời tiết xấu"** do admin bật tay, có hệ số và thời hạn tự tắt.
- **API báo giá** `POST /orders/quote`: nhận quán, địa chỉ và món, trả về **chi tiết phí** (tiền món, phí giao theo km, phụ phí cao điểm/đêm/thời tiết, giảm giá, tổng) cùng thời điểm báo giá.
  - Màn thanh toán **chỉ hiển thị số từ API này**.
  - Lúc đặt đơn, backend tính lại. Nếu lệch so với báo giá thì trả lỗi 409 kèm báo giá mới, app hỏi khách đồng ý giá mới.
- **Lưu chi tiết phí trong đơn** để quán, tài xế và admin xem lại được.
- **Thu nhập tài xế** tách khỏi phí khách trả, theo cấu hình (ví dụ tài xế nhận X% phí giao cộng phụ phí). Lưu số tiền tài xế nhận vào từng đơn.

### 3.2 Đánh giá thật cho quán, món và tài xế

**Hiện trạng:**

- Chỉ có đánh giá quán.
- Bảng chưa có `orderId`, nên "mỗi đơn một lần" đang tính gần đúng.
- Chủ quán chỉ thấy điểm trung bình, không thấy danh sách đánh giá.
- Tài xế hiện 5.0 viết cứng.

**Cần làm:**

- **Đánh giá gắn với đơn:** thêm `orderId` (unique) vào bảng đánh giá, hoặc tạo bảng mới `OrderReview`. Migration cần giữ được dữ liệu cũ.
- **Một lần đánh giá đơn gồm:**
  - Sao cho quán (bắt buộc) kèm nhận xét và thẻ nhanh.
  - Sao cho **từng món** (không bắt buộc).
  - Sao cho **tài xế** (không bắt buộc) kèm thẻ nhanh riêng.
- **Thời hạn:** chỉ đơn `DELIVERED`, trong vòng 7 ngày sau khi giao. Mỗi đơn một lần; được sửa trong 24 giờ.
- **Tính điểm:**
  - Điểm quán, món và tài xế là trung bình **có số lượt kèm theo** (ví dụ "4,6 (128)").
  - Quán dưới 5 lượt hiện "Mới".
  - Chỉ đánh giá từ đơn thật mới được tính.
- **Khách:**
  - Nhắc đánh giá sau khi giao (thông báo, và thẻ "Đánh giá đơn này" ở lịch sử đơn).
  - Xem đánh giá của người khác ở trang quán: lọc theo số sao, sắp xếp mới nhất; ẩn bớt họ tên (ví dụ "Nguyễn V. A.").
- **Chủ quán:**
  - Màn **"Đánh giá của khách"**: điểm trung bình, phân bố 1–5 sao, lọc theo sao và theo món, xem đơn liên quan.
  - **Trả lời** một đánh giá (một lần, sửa được). Câu trả lời hiện công khai dưới đánh giá.
- **Tài xế:** điểm thật, số lượt, các thẻ khen hoặc chê hay gặp, 10 nhận xét gần nhất. Ẩn tên khách.
- **Admin:** ẩn đánh giá vi phạm (có lý do); điểm được tính lại khi ẩn.

### 3.3 Chat theo đơn hàng (lưu lại, nhận được thật)

**Cần làm:**

- **Bảng tin nhắn** `OrderMessage`: `orderId`, `senderId`, `senderRole`, `channel` (`CUSTOMER_DRIVER`, `CUSTOMER_RESTAURANT`, `RESTAURANT_DRIVER`), nội dung, loại (chữ / tin mẫu / hệ thống), thời gian gửi, thời gian đã đọc.
- **Quyền:** chỉ người thuộc đơn (khách của đơn, chủ quán của quán, tài xế đã nhận) mới đọc và gửi được, và chỉ trong kênh của mình.
- **Thời gian mở chat:**

  | Kênh | Mở từ | Ghi chú |
  |---|---|---|
  | Khách ↔ quán | Quán nhận đơn | |
  | Khách ↔ tài xế | Tài xế nhận đơn | |
  | Quán ↔ tài xế | Tài xế nhận đơn | |

  Sau khi giao xong hoặc đơn bị huỷ, chat còn mở 60 phút, rồi chuyển sang **chỉ xem**.
- **API:**
  - Tải lịch sử, phân trang.
  - Gửi tin (giới hạn 500 ký tự, chặn gửi dồn dập, ví dụ 10 tin mỗi phút).
  - Đánh dấu đã đọc.
  - Đếm tin chưa đọc theo đơn.
- **Thời gian thực:**
  - Socket gửi tới phòng của đơn, kèm trạng thái đã đọc.
  - **Thông báo đẩy** khi người nhận không mở màn chat.
  - Ghi trong báo cáo: thông báo đẩy không chạy đầy đủ trong Expo Go, cần bản build riêng để thử thật.
- **Tin hệ thống tự sinh** khi trạng thái đơn đổi, ví dụ "Tài xế đã lấy món".
- **Tin mẫu cho tài xế:** "Tôi đang tới quán", "Tôi đã lấy món", "Tôi đã tới nơi", "Anh/chị xuống nhận giúp em".
- **Giao diện:**
  - Màn `ChatScreen` nối API thật, có các tab theo kênh, trạng thái đã gửi / đã xem.
  - Nút chat có số tin chưa đọc ở: màn theo dõi đơn của khách, thẻ đơn của quán, màn chi tiết chuyến của tài xế.
- **Khiếu nại:** admin và chăm sóc khách hàng xem được hội thoại của một đơn khi xử lý khiếu nại, chỉ đọc.
- **Tin nhắn lưu trên server,** đăng xuất hay đổi máy vẫn còn.

### 3.4 Vai trò và phân quyền

- **Thêm vai trò:**
  - `RESTAURANT_STAFF` (nhân viên quán): nhận đơn, từ chối đơn, báo món sẵn sàng, bật/tắt "còn món". **Không** sửa giá, sửa quán, xem doanh thu hay xem đánh giá.
  - `SUPPORT` (chăm sóc khách hàng): xem đơn, chat và khách; huỷ đơn kèm lý do; đánh dấu hoàn tiền. **Không** sửa cấu hình, xoá quán hay khoá admin.
  - `DISPATCHER` (điều phối): xem các đơn đang chạy; **gán tài xế thủ công** cho đơn không ai nhận; gỡ tài xế khỏi đơn bị kẹt (kèm lý do, có lịch sử).
- **Chủ quán mời nhân viên** bằng email hoặc số điện thoại; gỡ được nhân viên. Mỗi nhân viên gắn với một quán.
- **Phân quyền ở backend** bằng bảng quyền rõ ràng (vai trò → hành động). Kiểm tra ở mọi API; không chỉ ẩn nút trên app.
- **Nhật ký thao tác (audit log)** cho các hành động nhạy cảm: khoá tài khoản, huỷ đơn thay khách, gán hoặc gỡ tài xế, ẩn đánh giá, đổi cấu hình phí. Ghi ai làm, lúc nào, lý do.

### 3.5 Thanh toán, hoàn tiền và đối soát

- **Đơn VNPay không thanh toán:** **tự huỷ sau 15 phút** bằng tác vụ chạy định kỳ; trả thông báo cho khách.
- **Hoàn tiền:**
  - Đơn đã trả tiền bị huỷ thì đặt trạng thái `REFUNDED` hoặc `REFUND_PENDING` và tạo bản ghi hoàn tiền.
  - Admin hoặc chăm sóc khách hàng xác nhận đã hoàn.
  - Ghi trong báo cáo: hoàn tiền tự động qua VNPay chưa làm.
- **Tiền mặt tài xế thu hộ:** theo dõi **công nợ** của tài xế (đã thu, đã nộp); tài xế nợ quá hạn mức thì không nhận đơn tiền mặt.
- **Đối soát với quán** theo kỳ: doanh thu món, phí nền tảng (% cấu hình), số tiền phải trả quán. Admin xuất được bảng.

### 3.6 Vận hành đơn hàng

- **Quán không nhận đơn:** quá N phút (cấu hình, ví dụ 5 phút) thì tự huỷ, báo khách, hoàn tiền nếu đã trả.
- **Không có tài xế nhận:** quá M phút sau khi món sẵn sàng thì báo điều phối viên.
- **Lý do huỷ:** bắt buộc chọn từ danh sách khi quán hoặc chăm sóc khách hàng huỷ đơn; lưu vào lịch sử trạng thái.
- **Thời gian giao dự kiến:** thời gian chuẩn bị của quán + thời gian di chuyển theo đường thật. Hiện cho khách và cập nhật theo trạng thái.
- **Lọc đơn chờ theo vị trí tài xế:** chỉ hiện đơn có quán trong bán kính X km quanh vị trí tài xế (lấy từ hồ sơ tài xế), sắp xếp gần trước.
- **Khoá tài khoản tức thì:** kiểm tra trạng thái tài khoản (có bộ nhớ đệm ngắn) khi xác thực token, hoặc thu hồi phiên ngay khi khoá. Không để tài khoản bị khoá còn dùng được tới 15 phút.

### 3.7 Tìm kiếm và nội dung

- **Xếp hạng kết quả:** khớp đúng dấu lên trước khớp không dấu, tên quán và tên món lên trước mô tả. Kèm gợi ý từ khoá và lịch sử tìm kiếm.
- **API tải ảnh lên** (quán, món, ảnh đại diện): lưu file vào `public/uploads` như ảnh đại diện hiện có; giới hạn dung lượng và loại file; ảnh mới thay base64 trong cơ sở dữ liệu. Ảnh cũ vẫn hiển thị được.

---

## 4. Thứ tự giai đoạn (mỗi giai đoạn xong thì báo cáo rồi làm tiếp)

| Giai đoạn | Nội dung | Ghi chú |
|---|---|---|
| 1 | 3.1 Khoảng cách và phí giao (báo giá, cấu hình phí, địa chỉ giao dùng chung) | Ảnh hưởng tiền, làm trước |
| 2 | 3.2 Đánh giá đơn, món, tài xế; màn đánh giá của quán | Có migration |
| 3 | 3.3 Chat theo đơn | Có migration, cần thông báo đẩy |
| 4 | 3.5 và 3.6 Thanh toán, hoàn tiền, công nợ, vận hành đơn | Có tác vụ định kỳ |
| 5 | 3.4 Vai trò mở rộng và nhật ký thao tác | Có migration enum vai trò |
| 6 | 3.7 Tìm kiếm, tải ảnh lên | |

**Dừng lại hỏi mình khi:**

- Migration cần reset hoặc có nguy cơ mất dữ liệu.
- Cần dịch vụ trả phí hoặc thư viện mới.
- Phải đổi nghĩa một trường hay một API đang dùng.
- Yêu cầu mâu thuẫn với quy tắc chuyển trạng thái đơn.

---

## 5. Kiểm tra mỗi giai đoạn

- **Backend:** `npx tsc --noEmit -p tsconfig.build.json`, `npx eslint` cho file đã sửa, `npx jest`. Test bắt buộc cho:
  - Công thức phí và báo giá.
  - Điều kiện đánh giá.
  - Quyền đọc và gửi tin nhắn.
  - Thời gian mở chat.
  - Bảng phân quyền.
  - Tự huỷ đơn.
- **App:** `npx tsc --noEmit`, `npx eslint`, `npx jest`, `npx expo export -p web` và `npx expo export -p ios`.
- **Chạy thử** bằng các tài khoản demo (`customer@`, `owner@`, `driver@`, `admin@fooddelivery.com` / `Password123!`), theo một đơn **từ đặt tới đánh giá**:
  1. Khách xem báo giá có chi tiết phí rồi đặt đơn.
  2. Quán nhận đơn, khách và quán nhắn tin cho nhau.
  3. Tài xế nhận đơn, khách và tài xế nhắn tin, cả hai bên nhận được ngay.
  4. Đăng xuất rồi đăng nhập lại, tin nhắn vẫn còn.
  5. Giao xong, khách đánh giá quán, món và tài xế.
  6. Quán thấy đánh giá và trả lời; tài xế thấy điểm thật.
- **Dữ liệu thử:** ghi lại mã đơn và dữ liệu thử đã tạo; trả dữ liệu demo về như cũ nếu có sửa.

## 6. Báo cáo

Ghi vào `docs/BAO_CAO_NGHIEP_VU_CHUYEN_NGHIEP.md`, mỗi giai đoạn một mục:

- Tính năng đã làm, quy tắc nghiệp vụ áp dụng.
- Migration đã tạo, API mới hoặc thay đổi.
- Màn hình mới.
- Lệnh kiểm tra đã chạy và kết quả thật.
- Phần đã thử trên điện thoại thật và phần chưa kiểm chứng.
- **Chi phí dự kiến** nếu bật dịch vụ thật (ví dụ lưu trữ ảnh).
- Việc còn tồn đọng.
