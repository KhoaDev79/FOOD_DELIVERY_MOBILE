# Báo cáo kiểm tra và sửa nghiệp vụ ZomZom

Ngày 30/10/2026 · Phạm vi: khách hàng, chủ quán, tài xế, admin (backend NestJS và app Expo)

## 1. Tóm tắt

| | |
|---|---|
| Lỗi bạn báo | Chủ quán thêm món và đổi tên quán, nhưng tài khoản khách hàng không tìm thấy quán và món mới. **Đã tìm ra nguyên nhân và sửa.** |
| Lỗi nghiệp vụ khác phát hiện thêm | 14 lỗi, đã sửa 14 (mục 3) |
| Quy tắc nghiệp vụ bổ sung | Giờ mở cửa, thanh toán VNPay, giới hạn đơn của tài xế, đánh giá quán (mục 4) |
| Kiểm thử | Backend 57/57 test, app 42/42 test, kiểm tra kiểu sạch. Đã chạy thử trên server thật và bản web (mục 6). |
| Chưa làm | 7 việc cần quyết định thêm hoặc cần đổi cơ sở dữ liệu (mục 7) |

## 2. Vì sao khách hàng không thấy quán và món mới

Có bốn nguyên nhân chồng lên nhau:

1. **Quán ở quá xa khách.** Quán "khoa" nằm ở Cần Giờ, cách vị trí khách (trung tâm TP.HCM) khoảng **49,5 km**, trong khi quán chỉ giao trong **5 km**. Theo đúng nghiệp vụ, khách ở trung tâm không đặt được quán này. Đây không phải lỗi, nhưng app trước đây không cho khách biết gì.
2. **Tìm kiếm chỉ khớp tên quán.** Ô tìm kiếm ghi "Bạn đang tìm kiếm món gì?" nhưng backend chỉ tìm theo tên quán, nên gõ tên món không ra gì. Tìm kiếm còn phân biệt dấu, nên gõ "pho" không ra "Phở".
3. **Không có kết quả thì backend trả bừa 6 quán gần nhất,** không liên quan gì tới từ khoá. Ví dụ tìm "khoa" từ trung tâm ra 6 quán phở, bún.
4. **Món mới không lên trang chủ.** Mục "Món ngon gần bạn" lấy tối đa 3 món mỗi quán theo thứ tự **cũ nhất trước**, nên món vừa thêm (từ món thứ 4 trở đi) không bao giờ xuất hiện.

Thêm một lỗi phụ: khi đổi tài khoản trên cùng máy, dữ liệu đã tải của tài khoản trước vẫn còn trong bộ nhớ đệm, nên có thể thấy tên quán cũ.

**Sau khi sửa** (đã chạy thử trên server thật, vị trí trung tâm TP.HCM):

| Từ khoá | Trước | Sau |
|---|---|---|
| `khoa` | 6 quán phở, bún không liên quan | Quán "khoa" (49,5 km, nhãn **Ngoài vùng giao hàng**) và quán có món "Khoai tây chiên" |
| `cua bien` | Không có kết quả | Quán "khoa", dòng "Có món: Cua Biển Rang Me Cần Giờ" |
| `pho` (không dấu) | Không có kết quả | 5 quán, đứng đầu là Phở Bò Gia Truyền |
| `xyzabc` | 6 quán không liên quan | Không có kết quả (đúng) |

> Muốn khách ở trung tâm đặt được quán "khoa": vào **Cửa hàng → Sửa thông tin quán**, rồi ghim lại vị trí quán trên bản đồ, hoặc tăng bán kính giao hàng.

## 3. Lỗi đã sửa theo vai trò

### Khách hàng

| # | Lỗi | Ảnh hưởng | Đã sửa |
|---|---|---|---|
| K1 | Tìm kiếm chỉ khớp tên quán và phân biệt dấu | Không tìm được món | Tìm theo **tên quán, mô tả quán, tên món**, không phân biệt dấu và hoa/thường. Kết quả kèm "Có món: …" |
| K2 | Không có kết quả thì trả quán không liên quan | Kết quả sai | Có từ khoá thì chỉ trả quán khớp. Quán ngoài vùng giao vẫn hiện (trong 50 km) nhưng gắn nhãn **Ngoài vùng giao hàng** và xếp cuối |
| K3 | Trang chủ hiện các quán gần nhất khi không có quán giao tới, nhưng không báo là không giao được | Khách đặt rồi bị từ chối | Trả thêm `canDeliver = false`, thẻ quán hiện nhãn đỏ và ẩn phí ship |
| K4 | Món mới không lên trang chủ | Món của chủ quán "biến mất" | Ưu tiên món **mới nhất** của mỗi quán |
| K5 | Quán chỉ "đóng" khi chủ quán tắt công tắc, giờ mở cửa chỉ để hiển thị | Đặt được lúc nửa đêm | Quán chỉ nhận đơn khi **bật mở cửa và đang trong giờ mở cửa** (giờ VN, hỗ trợ mở qua đêm). Ngoài giờ thì hiện "Đã đóng" kèm giờ mở cửa |
| K6 | Màn chi tiết quán không báo khi quán không giao tới vị trí của khách | Đến lúc thanh toán mới biết | Thêm cảnh báo "Quán chỉ giao trong X km, vị trí của bạn cách Y km" |
| K7 | Màn đánh giá **chỉ giả lập**, không gửi gì lên server | Điểm quán không bao giờ thay đổi | API thật `POST /orders/:id/review`, điểm trung bình của quán được tính lại |
| K8 | Chọn kết quả tìm kiếm ở màn chọn địa chỉ thì lưu toạ độ cũ của bản đồ | Địa chỉ và vị trí ghim lệch nhau, phí ship sai | Lấy toạ độ thật của địa điểm và đưa bản đồ tới đó |

### Chủ quán

| # | Lỗi | Đã sửa |
|---|---|---|
| C1 | Đơn VNPay **chưa thanh toán** vẫn hiện, và quán vẫn bấm "Nhận đơn" được | Quán chỉ thấy đơn tiền mặt hoặc đơn đã thanh toán. Nhận đơn VNPay chưa trả tiền bị từ chối. Quán được báo khi khách thanh toán xong |
| C2 | Trạng thái quán chỉ có Mở/Đóng | Hiện **Đang nhận đơn / Ngoài giờ mở cửa / Đã đóng cửa** và lý do khách chưa đặt được |
| C3 | Thống kê tính cả đơn VNPay chưa thanh toán | Loại các đơn này khỏi thống kê |
| C4 | Đã sửa từ trước trong đợt này | Đăng xuất trên web, nút "Tài khoản cá nhân" không mở được, lưu thông tin quán luôn lỗi vì `@IsUrl`, thiếu nút từ chối đơn, thiếu bộ lọc "Đã nhận"/"Đã huỷ". Đã thêm: chọn địa chỉ trên bản đồ, giờ mở cửa, bán kính giao, thống kê, giảm giá món |

### Tài xế

| # | Lỗi | Đã sửa |
|---|---|---|
| T1 | Nhận được đơn VNPay chưa thanh toán | Danh sách đơn chờ và thao tác nhận đơn đều loại các đơn này |
| T2 | Nhận không giới hạn số đơn cùng lúc | Tối đa **2 đơn đang giao cùng lúc** (hằng số `MAX_ACTIVE_DELIVERIES`), có thông báo rõ khi vượt |
| T3 | Đăng xuất và mọi nút cần xác nhận (nhận chuyến, đã lấy hàng, đã giao) **không chạy trên web** | Thay `Alert` trên web bằng hộp thoại của trình duyệt cho toàn app. Đã thử: đăng xuất tài xế trên web chạy đúng |

### Admin

| # | Lỗi | Đã sửa |
|---|---|---|
| A1 | Tạo quán kèm chủ quán mới: mật khẩu tạm được sinh ra nhưng **không trả về** | Trả về `temporaryPassword` một lần. App hiện mật khẩu để admin gửi cho chủ quán |
| A2 | Xoá quán đã có đơn bị lỗi 500, vì đơn hàng tham chiếu tới quán | Trả lỗi 409 kèm hướng dẫn "Hãy đóng cửa quán để ngừng nhận đơn". Đơn cũ được giữ để đối soát |
| A3 | Admin tự khoá được chính mình hoặc khoá admin khác | Chặn cả hai trường hợp |
| A4 | Đăng xuất và các thao tác xoá, khoá **không chạy trên web** | Như T3 |

### Chung

| # | Lỗi | Đã sửa |
|---|---|---|
| G1 | Đổi tài khoản trên cùng máy vẫn thấy dữ liệu cũ | Tự xoá toàn bộ dữ liệu đã tải mỗi khi đổi tài khoản (`App.tsx`) |
| G2 | Huỷ đơn đã thanh toán VNPay không ghi nhận cần hoàn tiền | Đơn bị huỷ chuyển `paymentStatus = REFUNDED` để đối soát hoàn tiền |
| G3 | Test phí giao hàng thất bại vào giờ cao điểm (vì phụ thuộc giờ thật của máy) | Cố định thời điểm trong test, thêm test cho phụ phí 20% giờ cao điểm |
| G4 | Đăng nhập bằng tài khoản chủ quán, tài xế hoặc admin báo lỗi `The action 'NAVIGATE' ... 'MainTabs' was not handled`: app đã chuyển sang giao diện của vai trò đó, nhưng màn Đăng nhập vẫn điều hướng tới `MainTabs` (chỉ có ở giao diện khách) | Chỉ điều hướng sau đăng nhập khi là khách hàng; vai trò khác để `AppNavigator` tự chuyển |
| G5 | Cảnh báo `Non-serializable values were found in the navigation state` vì truyền hàm `onSelectAddress` qua tham số điều hướng tới màn chọn địa chỉ | Bỏ tham số dạng hàm. Màn chọn địa chỉ ghi kết quả vào `useAddressDraftStore`, màn Cửa hàng và màn Thêm địa chỉ đọc từ đó |

## 4. Quy tắc nghiệp vụ hiện hành

**Hiển thị quán cho khách**

- Trang chủ và gợi ý chỉ hiện quán giao tới vị trí của khách: khoảng cách ≤ bán kính giao của quán.
- Tìm kiếm khớp tên quán, mô tả quán hoặc tên món chưa xoá, không phân biệt dấu, phạm vi 50 km. Quán ngoài vùng giao vẫn hiện nhưng gắn nhãn và xếp sau.
- Trạng thái "Mở cửa" mà khách thấy = chủ quán bật mở cửa **và** đang trong giờ mở cửa (giờ VN). Giờ mở = giờ đóng nghĩa là mở cả ngày, giờ đóng nhỏ hơn giờ mở nghĩa là mở qua đêm.

**Đặt đơn** (backend kiểm tra lại toàn bộ, không tin dữ liệu từ app)

- Quán phải đang nhận đơn, địa chỉ giao phải trong bán kính giao của quán.
- Món phải thuộc đúng quán, còn bán, chưa xoá. Giá tính lại từ cơ sở dữ liệu (giá giảm, size, topping). Mỗi món tối đa 50 phần.
- Phí giao: giá cơ bản + phí theo km sau số km miễn phí, làm tròn lên 1.000 ₫, cộng 20% vào giờ cao điểm.

**Trạng thái đơn**

```
Chờ nhận ──(quán nhận)──► Đã nhận ──(quán)──► Đang chuẩn bị ──(quán)──► Chờ tài xế ──(tài xế lấy)──► Đang giao ──(tài xế)──► Đã giao
   │                         │
   └──► Đã huỷ ◄─────────────┘
```

- Khách chỉ huỷ được khi đơn đang "Chờ nhận". Quán huỷ hoặc từ chối được khi đơn đang "Chờ nhận" hoặc "Đã nhận".
- Đơn VNPay: quán và tài xế chỉ thấy sau khi khách thanh toán xong. Huỷ đơn đã thanh toán thì đánh dấu cần hoàn tiền.
- Tài xế nhận đơn từ lúc quán đã nhận (Đã nhận / Đang chuẩn bị / Chờ tài xế). Mỗi đơn chỉ một tài xế thắng khi nhiều người cùng bấm. Mỗi tài xế giao tối đa 2 đơn cùng lúc.
- Đơn tiền mặt chuyển "đã thanh toán" khi tài xế bấm đã giao.

**Giá, giảm giá, đánh giá, thống kê**

- **Giảm giá món:** chủ quán chọn 0, 5, 7, 10, 15 hoặc 20%. Backend tự tính giá sau giảm (làm tròn 100 ₫) và tính lại khi đổi giá gốc.
- **Đánh giá:** chỉ đơn đã giao; mỗi đơn một lần; điểm quán là trung bình các đánh giá, làm tròn 1 chữ số.
- **Doanh thu của quán:** tiền món của đơn đã giao thành công, không gồm phí giao.
- **Doanh thu toàn sàn ở admin (GMV):** gồm cả phí giao.

## 5. API thay đổi

| API | Thay đổi |
|---|---|
| `GET /restaurants/nearby` | Tìm theo món, không phân biệt dấu. Thêm trường `canDeliver`, `matchedDishes`. `isOpen` = đang nhận đơn thực tế |
| `GET /restaurants/nearby/dishes` | Chỉ quán đang trong giờ mở cửa, món mới nhất trước |
| `GET /restaurants/:id` | `isOpen` = đang nhận đơn thực tế |
| `GET /restaurants/mine` | Thêm `acceptingOrders` |
| `GET /restaurants/:id/stats?days=1\|7\|30` | **Mới.** Thống kê bán hàng cho chủ quán / admin |
| `PATCH /restaurants/:id` | Nhận `openTime`, `closeTime` (HH:mm). `imageUrl` nhận cả đường dẫn tương đối và base64 |
| `POST/PATCH /menu-items` | Nhận `discountPercent` (0, 5, 7, 10, 15, 20) |
| `POST /orders/:id/review` | **Mới.** Khách đánh giá đơn đã giao (`rating` 1–5, `comment`) |
| `GET /orders/restaurant/:id`, `GET /orders/available` | Loại đơn VNPay chưa thanh toán |
| `POST /orders/:id/accept` | Giới hạn 2 đơn đang giao |
| `POST /admin/restaurants` | Trả `temporaryPassword` khi tạo chủ quán mới |
| `DELETE /admin/restaurants/:id` | Trả 409 nếu quán đã có đơn |
| `PATCH /admin/users/:id/toggle-active` | Chặn tự khoá và khoá admin khác |

Không đổi cấu trúc cơ sở dữ liệu, nên không cần chạy migration.

## 6. Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Backend `npx jest` | 57/57 test qua (thêm test giờ mở cửa, bỏ dấu tiếng Việt, thống kê, giảm giá, phí giờ cao điểm) |
| Backend `tsc -p tsconfig.build.json` | Không lỗi |
| App `npx tsc --noEmit`, `npx jest` | Không lỗi, 42/42 test qua |
| App `expo export` iOS và web | Đóng gói thành công |
| Server thật: tìm kiếm | Đúng như bảng ở mục 2 |
| Server thật: admin xoá quán đã có đơn | 409 "Quán đã có 1 đơn hàng nên không thể xoá…" |
| Server thật: admin tự khoá | 400 "Không thể tự khoá tài khoản của chính mình" |
| Server thật: danh sách đơn của tài xế | Chỉ còn đơn tiền mặt và đơn VNPay đã thanh toán |
| Server thật: giảm giá 7% món 250.000 ₫ | 232.500 ₫; mức 3% bị từ chối; đã trả món về như cũ |
| Bản web: tài khoản khách tìm "cua bien" | Thẻ quán "khoa" có nhãn Ngoài vùng giao hàng và "Có món: Cua Biển…" |
| Bản web: tài xế đăng xuất | Hiện hộp xác nhận, bấm OK thì đăng xuất về trang chủ |

**Chưa thử:**

- Luồng đặt đơn đầy đủ từ đầu đến cuối (đặt → nhận → giao → đánh giá), vì sẽ tạo đơn thật trong cơ sở dữ liệu của bạn. Các quy tắc này đã được kiểm tra bằng đọc mã và test.
- Chưa thử trên điện thoại thật.

**Lỗi lint có từ trước, chưa sửa:**

- Backend: `IsUrl` thừa trong `menus.dto.ts` và `users.dto.ts`; `_ignored` trong `restaurants.service.ts`; `lat`/`lng` không dùng trong `fallback-map.provider.ts`.
- App: gọi `setState` trong `useEffect` ở `RestaurantDetailScreen.tsx`.

## 7. Chưa làm: cần bạn quyết định

1. **Đơn VNPay không thanh toán không tự huỷ.** Nên tự huỷ sau khoảng 15 phút bằng một tác vụ chạy định kỳ.
2. **Đơn chờ tài xế chưa lọc theo vị trí tài xế.** Mọi tài xế đều thấy mọi đơn. Muốn lọc theo khoảng cách thì app tài xế cần gửi vị trí lên.
3. **Bảng `reviews` chưa có cột `orderId`.** Hiện "mỗi đơn một đánh giá" được tính gần đúng bằng cách đếm theo cặp khách–quán. Nên thêm cột `orderId` (duy nhất), việc này cần một migration.
4. **Khoá tài khoản có độ trễ.** Access token sống 15 phút, nên tài khoản vừa bị khoá vẫn dùng được tối đa 15 phút. Muốn khoá tức thì thì cần kiểm tra trạng thái tài khoản ở mỗi request.
5. **Tìm không dấu có thể ra thừa kết quả.** Ví dụ "phở" cũng khớp "phô mai". Có thể ưu tiên kết quả khớp đúng dấu lên trước.
6. **Ảnh chọn từ máy lưu thẳng vào cơ sở dữ liệu (base64).** Nên có API tải ảnh lên riêng.
7. **Cảnh báo ngoài vùng giao ở màn chi tiết quán tính theo vị trí GPS,** chưa theo địa chỉ giao mà khách chọn. Backend vẫn kiểm tra đúng địa chỉ khi đặt đơn.

## 8. Cách tự kiểm tra lại

1. Khởi động lại backend (`npm run start:dev`) và app (`npx expo start -c`).
2. **Chủ quán:** vào Cửa hàng → Sửa thông tin quán → ghim vị trí quán ở TP.HCM, hoặc tăng bán kính giao. Thêm một món mới.
3. **Khách hàng:** tìm theo tên món, thử cả gõ không dấu. Món mới phải hiện ở trang chủ và trong kết quả tìm kiếm.
4. **Đổi giờ mở cửa** để giờ hiện tại nằm ngoài khung giờ: quán phải hiện "Đã đóng", và đặt đơn bị từ chối kèm giờ mở cửa.
5. **Đặt đơn VNPay nhưng không thanh toán:** quán và tài xế không thấy đơn. Thanh toán xong thì đơn hiện ra.
6. **Tài xế:** nhận 2 đơn, thử nhận đơn thứ 3 thì phải bị chặn.
7. **Trên web:** đăng xuất ở cả 4 vai trò đều chạy được.
