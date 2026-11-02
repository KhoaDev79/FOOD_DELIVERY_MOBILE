# Phụ lục 05 — Kiểm kê màn hình Tài xế, Chủ quán & Quản trị viên (mục 6.2)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md) | [← Về Phụ lục 04: Khách hàng & Auth](04-man-hinh-khach-va-auth.md)

Phụ lục này kiểm kê chi tiết toàn bộ các màn hình dành cho 3 vai trò chuyên trách của hệ thống: **Tài xế giao hàng (Driver)**, **Chủ nhà hàng (Restaurant Owner)** và **Quản trị viên (Admin)**.

---

## Mục lục danh mục màn hình (19 màn hình & bảng điều khiển)

### Nhóm A: Màn hình Tài xế (Driver)
1. [DriverAvailableOrdersScreen (DriverAvailableTab) — Tìm đơn mới quanh đây](#1-driveravailableordersscreen-driveravailabletab--tìm-đơn-mới-quanh-đây)
2. [DriverDeliveriesScreen (DriverDeliveriesTab) — Danh sách chuyến giao](#2-driverdeliveriesscreen-driverdeliveriestab--danh-sách-chuyến-giao)
3. [DriverDeliveryDetailScreen — Chi tiết chuyến giao, điều hướng & bản đồ](#3-driverdeliverydetailscreen--chi-tiết-chuyến-giao-điều-hướng--bản-đồ)
4. [DriverProfileScreen (DriverProfileTab) — Hồ sơ tài xế & Bật/Tắt trực tuyến](#4-driverprofilescreen-driverprofiletab--hồ-sơ-tài-xế--bậttắt-trực-tuyến)
5. [DriverVehicleScreen — Cập nhật thông tin phương tiện & bằng lái](#5-drivervehiclescreen--cập-nhật-thông-tin-phương-tiện--bằng-lái)
6. [DriverWalletScreen — Quản lý Ví & Sổ quỹ nợ tiền mặt COD](#6-driverwalletscreen--quản-lý-ví--sổ-quỹ-nợ-tiền-mặt-cod)
7. [DriverReviewsScreen — Đánh giá từ khách hàng & Phản hồi](#7-driverreviewsscreen--đánh-giá-từ-khách-hàng--phản-hồi)

### Nhóm B: Màn hình Chủ quán (Restaurant Owner)
8. [OwnerOrdersScreen (OwnerOrdersTab) — Quản lý đơn hàng quán](#8-ownerordersscreen-ownerorderstab--quản-lý-đơn-hàng-quán)
9. [OwnerMenuScreen (OwnerMenuTab) — Quản lý danh mục & thực đơn món](#9-ownermenuscreen-ownermenutab--quản-lý-danh-mục--thực-đơn-món)
10. [OwnerRestaurantScreen (OwnerRestaurantTab) — Cài đặt thông tin quán & giờ mở cửa](#10-ownerrestaurantscreen-ownerrestauranttab--cài-đặt-thông-tin-quán--giờ-mở-cửa)
11. [OwnerReviewsScreen — Quản lý đánh giá khách hàng & Phản hồi nhà hàng](#11-ownerreviewsscreen--quản-lý-đánh-giá-khách-hàng--phản-hồi-nhà-hàng)
12. [OwnerStatsScreen — Báo cáo doanh thu & thống kê bán hàng](#12-ownerstatsscreen--báo-cáo-doanh-thu--thống-kê-bán-hàng)

### Nhóm C: Màn hình Quản trị viên (Admin)
13. [AdminDashboardScreen (AdminDashboardTab) — Tổng quan số liệu hệ thống](#13-admindashboardscreen-admindashboardtab--tổng-quan-số-liệu-hệ-thống)
14. [AdminOrdersScreen (AdminOrdersTab) — Giám sát & can thiệp đơn hàng](#14-adminordersscreen-adminorderstab--giám-sát--can-thiệp-đơn-hàng)
15. [AdminUsersScreen (AdminUsersTab) — Quản lý người dùng & duyệt đối tác](#15-adminusersscreen-adminuserstab--quản-lý-người-dùng--duyệt-đối-tác)
16. [AdminRestaurantsScreen (AdminRestaurantsTab) — Quản lý quán ăn & gán chủ quán](#16-adminrestaurantsscreen-adminrestaurantstab--quản-lý-quán-ăn--gán-chủ-quán)
17. [AdminProfileScreen (AdminProfileTab) — Cài đặt hệ thống & hồ sơ Admin](#17-adminprofilescreen-adminprofiletab--cài-đặt-hệ-thống--hồ-sơ-admin)

---

## NHÓM A: MÀN HÌNH TÀI XẾ (DRIVER)

### 1. DriverAvailableOrdersScreen (DriverAvailableTab) — Tìm đơn mới quanh đây
- **Tên màn hình**: `DriverAvailableOrdersScreen`.
- **Tên route**: `'DriverAvailableTab'` trong `DriverTabParamList` (`mobile/src/navigation/DriverTabNavigator.tsx` dòng 23, 40).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverAvailableOrdersScreen.tsx` (645 dòng).
- **Vai trò**: Tài xế giao hàng (`Role.DRIVER`).
- **Mục đích**: Tìm kiếm và nhận các đơn hàng mới đang chờ tài xế trong bán kính lân cận; theo dõi trạng thái công nợ COD và chuyển đổi trạng thái trực tuyến / ngoại tuyến.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Tìm đơn mới", công tắc (Switch) Bật/Tắt chế độ Trực tuyến nhận chuyến.
  2. Cảnh báo công nợ COD (nếu số dư nợ vượt hạn mức cảnh báo hoặc hạn mức khoá nhận đơn).
  3. Thanh thống kê nhanh trong ca: Số đơn đã giao trong ngày, Tổng thu nhập tạm tính hôm nay.
  4. Danh sách các đơn hàng khả dụng dạng thẻ cuộn:
     - Thẻ đơn hàng mới: Mã đơn `#XXXXX`, khoảng cách từ tài xế đến quán + khoảng cách từ quán đến khách.
     - Điểm lấy món (Quán): Tên nhà hàng, địa chỉ quán.
     - Điểm giao món (Khách): Tên khách hàng, địa chỉ giao hàng.
     - Thu nhập thực nhận của tài xế (chữ xanh ngọc đậm).
     - Tiền mặt COD cần thu của khách (nếu đơn COD) và ước tính tiền nợ sau khi nhận.
     - Nút "Nhận đơn này" (`Button variant="primary"`).
  5. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: isOnline, codBalance, debtLimit, distanceToRestaurantKm, deliveryDistanceKm, driverEarning, codToCollect, restaurantName, deliveryAddress.
- **Các trạng thái đã xử lý**:
  - Tài xế đang ngoại tuyến: Hiển thị minh hoạ yêu cầu bật trực tuyến để quét tìm đơn.
  - Vượt hạn mức công nợ tiền mặt COD: Khoá nút nhận đơn kèm thông báo nộp tiền về công ty.
  - Chưa duyệt hồ sơ (`PENDING` / `REJECTED`): Hiển thị thông báo trạng thái xác thực xe.
  - Tự động lắng nghe đơn hàng mới thời gian thực qua Socket.IO `order:created`.
- **Thao tác bấm được và đích đến**:
  - Gạt công tắc trực tuyến -> gọi API cập nhật trạng thái hoạt động và toạ độ GPS.
  - Bấm "Nhận đơn này" -> gọi API `ordersApi.acceptOrder` -> Thành công chuyển sang `DriverDeliveryDetailScreen`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tìm đơn mới"`, `"Đang trực tuyến"`, `"Đang ngoại tuyến"`.
  - `"Thu nhập dự kiến"`, `"Thu tiền mặt COD"`, `"Nhận đơn này"`.
- **Nhận xét khách quan**:
  - Tính toán và cảnh báo công nợ COD rất chặt chẽ, ngăn ngừa rủi ro tài xế ôm tiền mặt vượt quá bảo chứng.

---

### 2. DriverDeliveriesScreen (DriverDeliveriesTab) — Danh sách chuyến giao
- **Tên màn hình**: `DriverDeliveriesScreen`.
- **Tên route**: `'DriverDeliveriesTab'` trong `DriverTabParamList` (`mobile/src/navigation/DriverTabNavigator.tsx` dòng 24, 45).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverDeliveriesScreen.tsx` (397 dòng).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Theo dõi danh sách các chuyến giao hàng đang thực hiện (chờ lấy món, đang giao) và lịch sử các chuyến đã hoàn thành / giao thất bại.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Chuyến giao", dòng dẫn thống kê số chuyến đang phụ trách.
  2. Thanh lọc trạng thái:
     - Đang giao (`CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`).
     - Hoàn thành (`DELIVERED`).
     - Thất bại (`DELIVERY_FAILED`, `CANCELLED`).
  3. Danh sách chuyến giao:
     - Thẻ đơn hàng: Mã đơn, thời gian nhận chuyến, trạng thái chi tiết.
     - Lộ trình tóm tắt: Quán lấy món -> Khách nhận món.
     - Số tiền thu nhập của tài xế và số tiền COD cần thu.
     - Nút "Tiếp tục giao hàng" (đối với chuyến đang hoạt động).
  4. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: orderId, status, createdAt, restaurantName, customerName, driverEarning, codToCollect.
- **Các trạng thái đã xử lý**: Không có chuyến giao nào (`EmptyState`), Đang tải, Kéo để làm mới.
- **Thao tác bấm được và đích đến**:
  - Bấm vào thẻ chuyến -> mở `DriverDeliveryDetailScreen`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Chuyến giao"`, `"Đang thực hiện"`, `"Lịch sử chuyến"`, `"Tiếp tục chuyến giao"`.

---

### 3. DriverDeliveryDetailScreen — Chi tiết chuyến giao, điều hướng & bản đồ
- **Tên màn hình**: `DriverDeliveryDetailScreen`.
- **Tên route**: `'DriverDeliveryDetail'` trong `DriverStackParamList` (`mobile/src/types/navigation.ts` dòng 69).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverDeliveryDetailScreen.tsx` (1098 dòng - màn hình phức tạp nhất app).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Màn hình tác nghiệp chính trong suốt hành trình giao món: xem bản đồ lộ trình di chuyển, điều hướng qua Google Maps/Apple Maps, gọi điện/nhắn tin cho Quán và Khách, ghi nhận đã đến nơi, ghi nhận cuộc gọi và chuyển các trạng thái đơn hàng (Đã lấy món, Giao thành công, Giao thất bại, Huỷ trả đơn).
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Đơn hàng #XXXXX", nút quay lại.
  2. Bản đồ lộ trình tương tác (`AppMapView`):
     - Vẽ polyline đường đi từ vị trí tài xế -> Quán ăn -> Khách hàng.
     - Ghim 3 điểm với icon riêng biệt.
     - Nút mở ứng dụng Bản đồ ngoài (Google Maps / Apple Maps chỉ đường chi tiết).
  3. Thanh tiến trình 4 giai đoạn đơn hàng (Nhận đơn -> Đến quán -> Lấy món -> Giao khách).
  4. Khối "Lộ trình giao hàng" chi tiết:
     - **Điểm 1 (Quán lấy món)**: Tên nhà hàng, Địa chỉ chi tiết của quán, Hotline quán, Nút bấm gọi điện thoại cho quán.
     - **Điểm 2 (Khách nhận món)**: Họ tên khách hàng, Số điện thoại khách hàng, Địa chỉ nhận hàng chi tiết, Ghi chú giao hàng.
     - **Hàng nút liên hệ**: Nút "Gọi khách", Nút "Nhắn tin" (mở `ChatScreen`), Nút "Gọi quán".
  5. Khối "Tài chính chuyến giao":
     - Thu nhập thực nhận của tài xế.
     - Tiền mặt COD cần thu từ khách (hiển thị đậm màu cam nếu là đơn COD).
  6. Khối "Danh sách món cần lấy": Tên món, số lượng, tuỳ chọn kèm theo để kiểm đếm khi nhận món từ quán.
  7. Khối hành động nghiệp vụ theo quy trình nghiêm ngặt:
     - Nút "Tôi đã đến quán" -> kích hoạt GPS xác thực trong bán kính 100m.
     - Nút "Đã lấy món & Bắt đầu giao" -> chuyển trạng thái sang `PICKED_UP`.
     - Nút "Đã đến điểm giao" -> ghi nhận toạ độ và thời gian `arrivedAt`.
     - Bộ đếm và nút "Ghi nhận cuộc gọi cho khách": Yêu cầu gọi tối thiểu 3 cuộc cách nhau sau khi đến nơi trước khi được phép báo giao thất bại.
     - Nút "Giao hàng thành công" (`Button variant="primary"`): Yêu cầu xác nhận thu đủ tiền COD nếu có.
     - Nút "Giao thất bại" / "Huỷ trả đơn": Kèm bảng chọn lý do khách quan hợp lệ.
- **Các trường dữ liệu hiển thị**: Tọa độ GPS 3 điểm, Họ tên & SĐT & Địa chỉ khách, Tên & SĐT & Địa chỉ quán, Chi tiết món, Tiền COD, Thu nhập tài xế, Số lần gọi điện, Thời gian chờ.
- **Các trạng thái đã xử lý**:
  - Gửi vị trí GPS định kỳ mỗi 2 giây qua Socket.IO `driver:location`.
  - Kiểm tra khoảng cách thực tế khi bấm "Đã đến nơi" (chống gian lận vị trí).
  - Quy tắc Contact Attempts: Bắt buộc gọi đủ số lần mới mở khoá nút Giao thất bại.
- **Thao tác bấm được và đích đến**:
  - Bấm "Gọi khách" / "Gọi quán" -> mở ứng dụng quay số điện thoại.
  - Bấm "Nhắn tin" -> `navigation.navigate('Chat', { orderId, recipientName: order.customer.fullName, recipientRole: 'Khách hàng' })`.
  - Bấm "Chỉ đường" -> `Linking.openURL('https://www.google.com/maps/dir/?api=1...')`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Lộ trình giao hàng"`, `"ĐIỂM LẤY MÓN (QUÁN)"`, `"ĐIỂM GIAO MÓN (KHÁCH HÀNG)"`.
  - `"SĐT quán: [SĐT]"`, `"Gọi khách"`, `"Nhắn tin"`, `"Gọi quán"`.
  - `"Đã lấy món & Bắt đầu giao"`, `"Giao hàng thành công"`, `"Báo giao thất bại"`.
- **Nhận xét khách quan**:
  - Màn hình được thiết kế cực kỳ chặt chẽ về mặt nghiệp vụ chống gian lận vị trí và bảo vệ quyền lợi tài xế khi giao không thành công.
  - Tích hợp đầy đủ thông tin số điện thoại và địa chỉ chi tiết của cả 2 điểm dừng.

---

### 4. DriverProfileScreen (DriverProfileTab) — Hồ sơ tài xế & Bật/Tắt trực tuyến
- **Tên màn hình**: `DriverProfileScreen`.
- **Tên route**: `'DriverProfileTab'` trong `DriverTabParamList` (`mobile/src/navigation/DriverTabNavigator.tsx` dòng 26, 56).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverProfileScreen.tsx` (459 dòng).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Quản lý thông tin tài xế, xem trạng thái kiểm duyệt phương tiện, bật/tắt trực tuyến và truy cập nhanh vào Ví tiền, Đánh giá, Thông tin xe, Lịch sử chuyến và Đăng xuất.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề lớn "Tài xế", hiển thị huy hiệu trạng thái tài xế (`Đã duyệt`, `Chờ duyệt`, `Bị khoá`).
  2. Thẻ hồ sơ tài xế:
     - Avatar chữ cái đầu, Họ và tên tài xế, Số điện thoại.
     - Huy hiệu loại xe (Xe máy, Xe máy điện, Xe đạp), Biển số xe.
     - Hàng công tắc Trực tuyến / Ngoại tuyến.
  3. Thẻ tóm tắt ví & công nợ:
     - Số dư nợ COD hiện tại, Hạn mức công nợ tối đa.
     - Nút "Nộp tiền / Xem ví" dẫn sang `DriverWalletScreen`.
  4. Danh sách menu tiện ích (`ListRow`):
     - Dòng: "Đánh giá từ khách hàng" -> `DriverReviewsScreen`.
     - Dòng: "Thông tin phương tiện & bằng lái" -> `DriverVehicleScreen`.
     - Dòng: "Ví & Công nợ tiền mặt COD" -> `DriverWalletScreen`.
     - Dòng: "Thông tin cá nhân & mật khẩu" -> `EditProfileScreen`.
     - Dòng: "Lịch sử chuyến giao" -> chuyển tab `DriverDeliveriesTab`.
  5. Nút "Đăng xuất" (`Button variant="dangerSoft"`).
- **Các trường dữ liệu hiển thị**: fullName, phone, verificationStatus, vehicleBrand, vehicleModel, licensePlate, codBalance, debtLimit, rating.
- **Các trạng thái đã xử lý**: Xác thực trạng thái hồ sơ, Hộp thoại xác nhận đăng xuất.
- **Thao tác bấm được và đích đến**:
  - Bấm các dòng menu -> chuyển màn hình tương ứng.
  - Bấm "Đánh giá từ khách hàng" -> `navigation.navigate('DriverReviews')`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tài xế"`, `"Đánh giá từ khách hàng"`, `"Xem nhận xét và phản hồi đánh giá các chuyến giao"`.
  - `"Ví & Công nợ tiền mặt COD"`, `"Đăng xuất"`.

---

### 5. DriverVehicleScreen — Cập nhật thông tin phương tiện & bằng lái
- **Tên màn hình**: `DriverVehicleScreen`.
- **Tên route**: `'DriverVehicle'` trong `DriverStackParamList` (`mobile/src/types/navigation.ts` dòng 71).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverVehicleScreen.tsx` (339 dòng).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Cập nhật biển số xe, hãng xe, dòng xe, màu xe, hạng bằng lái, thông tin tài khoản ngân hàng và số điện thoại liên hệ khẩn cấp.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Thông tin phương tiện", nút quay lại.
  2. Khối chọn loại phương tiện: 3 chip bấm chọn (`Xe máy xăng`, `Xe máy điện`, `Xe đạp`).
  3. Form thông tin xe:
     - Hãng xe (Honda, Yamaha, VinFast...).
     - Dòng xe (Wave, Vision, Feliz...).
     - Màu xe.
     - Biển số xe (VD: 29A1-123.45).
     - Hạng bằng lái (A1, A2...).
  4. Form thông tin ngân hàng rút tiền:
     - Tên ngân hàng, Số tài khoản, Tên chủ tài khoản.
  5. Form liên hệ khẩn cấp:
     - Tên người thân, Số điện thoại khẩn cấp.
  6. Nút "Lưu thông tin" (`Button size="lg"`).
- **Các trường dữ liệu hiển thị**: vehicleType, vehicleBrand, vehicleModel, vehicleColor, licensePlate, driverLicenseClass, bankName, bankAccountNumber, emergencyContactName, emergencyContactPhone.
- **Các trạng thái đã xử lý**: Kiểm tra định dạng biển số xe Việt Nam (dùng regex tiện ích `vietnamese-plate`), Đang lưu thông tin.
- **Thao tác bấm được và đích đến**: Bấm lưu -> gọi API `driversApi.updateVehicle`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Thông tin phương tiện"`, `"Biển số xe"`, `"Tài khoản ngân hàng"`, `"Liên hệ khẩn cấp"`.

---

### 6. DriverWalletScreen — Quản lý Ví & Sổ quỹ nợ tiền mặt COD
- **Tên màn hình**: `DriverWalletScreen`.
- **Tên route**: `'DriverWallet'` trong `DriverStackParamList` (`mobile/src/types/navigation.ts` dòng 72).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverWalletScreen.tsx` (223 dòng).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Theo dõi số dư công nợ tiền mặt COD đang giữ của công ty, hạn mức nợ cho phép và xem toàn bộ lịch sử biến động sổ quỹ (thu tiền đơn, nộp tiền hoàn quỹ, thưởng/phạt).
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Ví & Công nợ COD".
  2. Thẻ số dư nổi bật:
     - Số dư nợ hiện tại (VND).
     - Thanh vạch hạn mức công nợ (màu xanh lá -> vàng -> đỏ khi nợ cao).
     - Hạn mức nợ tối đa được phép nhận đơn (mặc định 2.000.000 ₫).
  3. Hướng dẫn nộp tiền hoàn quỹ: Số tài khoản ngân hàng công ty để tài xế chuyển khoản nộp COD kèm cú pháp chuyển tiền mẫu.
  4. Danh sách biến động sổ quỹ (`DriverLedgerEntry`):
     - Loại biến động: Thu COD từ đơn hàng (+), Nộp tiền đối soát hoàn quỹ (-), Điều chỉnh công nợ.
     - Số tiền biến động, Số dư sau biến động, Thời gian và Ghi chú.
- **Các trường dữ liệu hiển thị**: codBalance, debtLimit, ledgerEntries (type, amount, balanceAfter, note, createdAt).
- **Các trạng thái đã xử lý**: Cảnh báo vượt hạn mức (chữ đỏ), Danh sách biến động rỗng.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Ví & Công nợ tiền mặt COD"`, `"Hạn mức cho phép"`, `"Lịch sử thu nộp tiền"`.

---

### 7. DriverReviewsScreen — Đánh giá từ khách hàng & Phản hồi
- **Tên màn hình**: `DriverReviewsScreen`.
- **Tên route**: `'DriverReviews'` trong `DriverStackParamList` (`mobile/src/types/navigation.ts` dòng 73).
- **Đường dẫn file**: `mobile/src/screens/driver/DriverReviewsScreen.tsx` (244 dòng).
- **Vai trò**: Tài xế giao hàng.
- **Mục đích**: Xem toàn bộ các đánh giá số sao và lời nhận xét mà khách hàng đã gửi cho tài xế sau mỗi chuyến đi; cho phép tài xế gửi phản hồi công khai lịch sự tới khách hàng.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Đánh giá từ khách hàng", nút quay lại.
  2. Thanh bộ lọc: Chip "Tất cả ([số lượng])" và Chip "Chưa phản hồi ([số lượng])".
  3. Danh sách thẻ đánh giá (`FlatList`):
     - Huy hiệu điểm sao: Icon ngôi sao vàng + Điểm `X/5`.
     - Tên khách hàng (được hệ thống tự động che ẩn danh dạng `Nguyễn ***`).
     - Thời gian đánh giá.
     - Huy hiệu mã đơn hàng `#XXXXX` và Tên quán ăn của đơn.
     - Lời nhận xét bằng chữ của khách hàng (hoặc dòng chữ nghiêng nếu khách chỉ chấm sao không viết chữ).
     - Khung phản hồi hiện tại của tài xế (nếu đã phản hồi trước đó).
     - Khung nhập phản hồi mới (nếu chưa phản hồi): Nút "Phản hồi đánh giá" mở ô nhập text và 2 nút "Huỷ" / "Gửi phản hồi".
  4. Khoảng đệm chân trang.
- **Các trường dữ liệu hiển thị**: driverRating, driverComment, driverReply, driverRepliedAt, customerName, orderId, restaurantName, createdAt.
- **Các trạng thái đã xử lý**: Lọc chưa phản hồi, Đang gửi phản hồi, Danh sách rỗng (`EmptyState`), Kéo làm mới.
- **Thao tác bấm được và đích đến**:
  - Bấm "Phản hồi đánh giá" -> mở form nhập.
  - Bấm "Gửi phản hồi" -> gọi API `driversApi.replyReview` -> tự động gửi thông báo push cho khách hàng.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đánh giá từ khách hàng"`, `"Chưa phản hồi"`, `"Phản hồi của bạn"`.
  - `"Phản hồi đánh giá"`, `"Gửi phản hồi"`.
- **Nhận xét khách quan**:
  - Bảo đảm quyền riêng tư cho khách hàng bằng cơ chế ẩn danh tên khách `maskCustomerName`.
  - Giúp tài xế chủ động giao tiếp và chăm sóc khách hàng chuyên nghiệp.

---

## NHÓM B: MÀN HÌNH CHỦ QUÁN (RESTAURANT OWNER)

### 8. OwnerOrdersScreen (OwnerOrdersTab) — Quản lý đơn hàng quán
- **Tên màn hình**: `OwnerOrdersScreen`.
- **Tên route**: `'OwnerOrdersTab'` trong `OwnerTabParamList` (`mobile/src/navigation/OwnerTabNavigator.tsx` dòng 21, 35).
- **Đường dẫn file**: `mobile/src/screens/owner/OwnerOrdersScreen.tsx` (610 dòng).
- **Vai trò**: Chủ nhà hàng (`Role.RESTAURANT_OWNER`).
- **Mục đích**: Tiếp nhận và quản lý đơn đặt món của quán theo thời gian thực: nhận đơn, chuẩn bị món, giao cho tài xế, nhắn tin cho khách/tài xế và xử lý huỷ đơn nếu hết món.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Đơn hàng", công tắc Mở cửa / Đóng cửa quán.
  2. Hàng 3 thẻ thống kê nhanh: Số đơn mới, Đã nhận, Đang chuẩn bị.
  3. Thanh tab lọc trạng thái cuộn ngang (Tất cả, Chờ nhận, Đã nhận, Đang chuẩn bị, Chờ tài xế, Đang giao, Hoàn thành, Giao thất bại, Đã huỷ).
  4. Danh sách các thẻ đơn hàng (`OrderCard`):
     - Mã đơn `#XXXXX`, thời gian tạo đơn, huy hiệu trạng thái.
     - **Thông tin Khách hàng**: Họ tên, Số điện thoại khách, Địa chỉ giao hàng chi tiết, Nút "Nhắn tin" (Chat với khách).
     - **Danh sách món đặt**: Số lượng x Tên món, Ghi chú món, Thành tiền của từng món (đã sửa triệt để lỗi NaN đ, fallback an toàn).
     - Ghi chú đơn hàng chung của khách (nếu có).
     - **Thông tin Tài xế đã nhận**: Họ tên tài xế, Số điện thoại tài xế, Biển số xe, Dòng xe, Nút "Nhắn tài xế".
     - Tổng tiền đơn hàng, hình thức thanh toán.
     - Hàng nút hành động theo máy trạng thái:
       - Đơn mới: Nút "Nhận đơn" (xanh ngọc) và Nút "Từ chối" (đỏ).
       - Đã nhận: Nút "Bắt đầu làm món".
       - Đang làm: Nút "Món đã sẵn sàng (Chờ tài xế đến lấy)".
  5. Hộp thoại xác nhận thao tác và huỷ đơn (`ConfirmDialog`).
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: orderId, status, createdAt, customerName, customerPhone, deliveryAddress, driverName, driverPhone, driverLicensePlate, driverVehicle, items (name, quantity, unitPrice, lineTotal, note), total, paymentMethod.
- **Các trạng thái đã xử lý**: Tự động nhận đơn mới qua Socket.IO `order:created`, Âm thanh/thông báo khi có đơn mới, Đổi trạng thái theo đúng quy tắc State Machine, Không có đơn hàng (`EmptyState`).
- **Thao tác bấm được và đích đến**:
  - Bấm "Nhắn tin" cạnh khách -> mở `ChatScreen` với khách.
  - Bấm "Nhắn tài xế" -> mở `ChatScreen` với tài xế.
  - Bấm "Nhận đơn" / "Làm món" / "Sẵn sàng" -> gọi API chuyển trạng thái đơn.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đơn hàng"`, `"Nhận đơn"`, `"Bắt đầu chuẩn bị"`, `"Món đã sẵn sàng"`.
  - `"Tài xế: [Tên tài xế]"`, `"SĐT: [SĐT]"`, `"Biển số: [Biển số]"`.
  - `"Nhắn tin"`, `"Nhắn tài xế"`.
- **Nhận xét khách quan**:
  - Đã khắc phục hoàn toàn lỗi hiển thị `NaN đ` tại dòng món ăn.
  - Hiển thị đầy đủ thông tin tài xế và khách hàng kèm lối tắt nhắn tin trực tiếp.

---

### 9. OwnerMenuScreen (OwnerMenuTab) — Quản lý danh mục & thực đơn món
- **Tên màn hình**: `OwnerMenuScreen`.
- **Tên route**: `'OwnerMenuTab'` trong `OwnerTabParamList` (`mobile/src/navigation/OwnerTabNavigator.tsx` dòng 22, 36).
- **Đường dẫn file**: `mobile/src/screens/owner/OwnerMenuScreen.tsx` (679 dòng).
- **Vai trò**: Chủ nhà hàng.
- **Mục đích**: Thêm, sửa, xoá danh mục món ăn; thêm món mới, cập nhật giá bán, bật/tắt trạng thái Còn món / Hết hàng, thiết lập các nhóm tuỳ chọn (Size, Topping).
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Thực đơn", nút dấu cộng (+) thêm danh mục mới.
  2. Thanh tab danh mục cuộn ngang (kèm nút sửa/xoá danh mục).
  3. Nút lớn "Thêm món mới vào danh mục này".
  4. Danh sách các món ăn trong danh mục đã chọn:
     - Ảnh món, tên món, mô tả, giá tiền.
     - Công tắc (Switch) Bật/Tắt trạng thái "Còn hàng / Hết hàng" tức thời.
     - Nút "Sửa món" mở modal chỉnh sửa chi tiết.
     - Nút "Lưu trữ / Xoá món".
  5. Modal Tạo / Sửa món ăn (`DishModal`):
     - Nhập tên món, mô tả món, giá cơ bản, tải ảnh món.
     - Thiết lập tuỳ chọn Size (Thêm size + phụ thu).
     - Thiết lập tuỳ chọn Topping (Thêm topping + đơn giá).
     - Nút Lưu thay đổi.
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: Tên danh mục, Tên món, Giá bán, Trạng thái còn hàng (`isAvailable`), Danh sách size/topping.
- **Các trạng thái đã xử lý**: Tải danh mục/món, Bật/tắt còn hàng với phản hồi lạc quan (Optimistic update), Modal thêm/sửa món.
- **Thao tác bấm được và đích đến**: Bấm switch còn hàng -> gọi API cập nhật trạng thái món; Bấm lưu modal -> gọi API tạo/sửa món.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Thực đơn"`, `"Thêm món mới"`, `"Còn món"`, `"Hết hàng"`, `"Lưu thay đổi"`.

---

### 10. OwnerRestaurantScreen (OwnerRestaurantTab) — Cài đặt thông tin quán & giờ mở cửa
- **Tên màn hình**: `OwnerRestaurantScreen`.
- **Tên route**: `'OwnerRestaurantTab'` trong `OwnerTabParamList` (`mobile/src/navigation/OwnerTabNavigator.tsx` dòng 24, 38).
- **Đường dẫn file**: `mobile/src/screens/owner/OwnerRestaurantScreen.tsx` (691 dòng).
- **Vai trò**: Chủ nhà hàng.
- **Mục đích**: Cập nhật hồ sơ nhà hàng: tên quán, số điện thoại hotline, địa chỉ chi tiết, ghim toạ độ bản đồ, bán kính giao hàng tối đa, khung giờ mở cửa các ngày trong tuần và lối tắt quản lý đánh giá / thống kê.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Cửa hàng", công tắc Bật/Tắt mở cửa nhận đơn.
  2. Khối ảnh đại diện & ảnh bìa nhà hàng (hỗ trợ chọn ảnh từ thư viện thiết bị).
  3. Form thông tin cơ bản:
     - Tên nhà hàng (`Input`).
     - Số điện thoại Hotline quán (`Input` - bắt buộc).
     - Địa chỉ chi tiết (`Input`).
     - Nút "Ghim vị trí quán trên bản đồ" -> mở `AddressPickerScreen`.
     - Bán kính phục vụ tối đa (km) kèm thanh trượt hoặc ô nhập.
  4. Khối thiết lập khung giờ mở cửa trong tuần (Thứ 2 đến Chủ nhật): Cài đặt giờ mở - giờ đóng từng ngày hoặc Đóng cửa cả ngày.
  5. Khối liên kết quản lý:
     - Dòng `ListRow`: "Xem & phản hồi đánh giá khách hàng" -> `OwnerReviewsScreen`.
     - Dòng `ListRow`: "Báo cáo doanh thu & Thống kê" -> `OwnerStatsScreen`.
     - Dòng `ListRow`: "Tài khoản cá nhân & Đổi mật khẩu" -> `EditProfileScreen`.
  6. Nút "Lưu cài đặt nhà hàng" (`Button size="lg"`).
  7. Nút "Đăng xuất" (`Button variant="dangerSoft"`).
  8. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: name, phone, address, latitude, longitude, deliveryRadiusKm, openingHours, isOpen, rating.
- **Các trạng thái đã xử lý**: Kiểm tra hợp lệ dữ liệu, Tải ảnh lên cloud storage, Lưu thành công.
- **Thao tác bấm được và đích đến**:
  - Bấm "Ghim vị trí" -> `navigation.navigate('AddressPicker', { ... })`.
  - Bấm "Đánh giá" -> `navigation.navigate('OwnerReviews')`.
  - Bấm "Thống kê" -> `navigation.navigate('OwnerStats')`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Cửa hàng"`, `"Thông tin quán"`, `"Hotline quán"`, `"Khung giờ mở cửa"`, `"Lưu cài đặt"`.

---

### 11. OwnerReviewsScreen — Quản lý đánh giá khách hàng & Phản hồi nhà hàng
- **Tên màn hình**: `OwnerReviewsScreen`.
- **Tên route**: `'OwnerReviews'` trong `OwnerStackParamList` (`mobile/src/types/navigation.ts` dòng 53).
- **Đường dẫn file**: `mobile/src/screens/owner/OwnerReviewsScreen.tsx` (227 dòng).
- **Vai trò**: Chủ nhà hàng.
- **Mục đích**: Xem toàn bộ nhận xét và số sao của khách hàng về quán; viết phản hồi chính thức từ phía nhà hàng tới từng đánh giá.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Đánh giá của quán", nút quay lại.
  2. Điểm đánh giá trung bình tổng quan (VD: `4.8 ★ / 5` dựa trên 120 lượt đánh giá).
  3. Bộ lọc: Tab "Tất cả" và Tab "Chưa phản hồi".
  4. Danh sách các đánh giá của khách:
     - Điểm sao, Tên khách hàng (ẩn danh), Ngày đánh giá.
     - Mã đơn hàng liên quan.
     - Lời nhận xét của khách về chất lượng món ăn / đóng gói.
     - Khung phản hồi hiện tại của quán (nếu đã phản hồi).
     - Khung nhập phản hồi mới cho chủ quán (nếu chưa phản hồi).
- **Các trường dữ liệu hiển thị**: rating, comment, ownerReply, ownerRepliedAt, customerName, orderId, createdAt.
- **Các trạng thái đã xử lý**: Gửi phản hồi mới kèm thông báo push cho khách hàng.
- **Thao tác bấm được và đích đến**: Bấm gửi phản hồi -> gọi API `restaurantsApi.replyReview`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đánh giá của quán"`, `"Phản hồi từ nhà hàng"`, `"Gửi phản hồi"`.

---

### 12. OwnerStatsScreen — Báo cáo doanh thu & thống kê bán hàng
- **Tên màn hình**: `OwnerStatsScreen`.
- **Tên route**: `'OwnerStats'` trong `OwnerStackParamList` (`mobile/src/types/navigation.ts` dòng 51).
- **Đường dẫn file**: `mobile/src/screens/owner/OwnerStatsScreen.tsx` (293 dòng).
- **Vai trò**: Chủ nhà hàng.
- **Mục đích**: Báo cáo tình hình kinh doanh của quán theo khoảng thời gian: Hôm nay, 7 ngày qua, 30 ngày qua; biểu đồ doanh thu và danh sách các món bán chạy nhất.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Thống kê bán hàng", nút quay lại.
  2. Hàng chip chọn mốc thời gian: Hôm nay, 7 ngày qua, 30 ngày qua.
  3. Thẻ doanh thu tổng quan lớn: Doanh thu thực nhận, Tỷ lệ tăng trưởng so với kỳ trước.
  4. Lưới 3 chỉ số chính: Tổng số đơn hoàn thành, Giá trị trung bình mỗi đơn (AOV), Tỷ lệ đơn huỷ.
  5. Biểu đồ thanh doanh thu theo ngày (Bar Chart) vẽ bằng View Native thuần.
  6. Bảng xếp hạng Top 5 món bán chạy nhất của quán (Tên món, số lượng đã bán, doanh thu món).
- **Các trường dữ liệu hiển thị**: totalRevenue, totalOrders, averageOrderValue, cancellationRate, topSellingItems.
- **Các trạng thái đã xử lý**: Đang tính toán dữ liệu, Lỗi thống kê.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Thống kê bán hàng"`, `"Tổng doanh thu"`, `"Đơn thành công"`, `"Top món bán chạy"`.

---

## NHÓM C: MÀN HÌNH QUẢN TRỊ VIÊN (ADMIN)

### 13. AdminDashboardScreen (AdminDashboardTab) — Tổng quan số liệu hệ thống
- **Tên màn hình**: `AdminDashboardScreen`.
- **Tên route**: `'AdminDashboardTab'` trong `AdminTabParamList` (`mobile/src/navigation/AdminTabNavigator.tsx` dòng 17, 30).
- **Đường dẫn file**: `mobile/src/screens/admin/AdminDashboardScreen.tsx` (349 dòng).
- **Vai trò**: Quản trị viên hệ thống (`Role.ADMIN`).
- **Mục đích**: Trung tâm điều hành toàn hệ thống ZomZom: giám sát doanh thu toàn sàn, số lượng đơn hàng theo thời gian thực, tổng số tài xế đang trực tuyến, các cảnh báo đơn bị kẹt (stalled orders) và các yêu cầu đăng ký đối tác chờ duyệt.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Tổng quan", dòng phụ "Trung tâm quản trị hệ thống ZomZom".
  2. Khối cảnh báo đơn kẹt (Stalled Orders Banner): Khung màu cam nổi bật nếu có đơn hàng bị treo quá thời hạn cần can thiệp kèm nút "Xử lý ngay".
  3. Khối chỉ số KPI chính:
     - Tổng giá trị giao dịch (GMV).
     - Hoa hồng sàn thu được (Platform Commission).
     - Tổng số đơn hàng trong ngày.
     - Số lượng tài xế đang trực tuyến (`Active Drivers`).
  4. Thẻ lối tắt nhanh:
     - Nút "Duyệt yêu cầu đối tác ([số lượng chờ])" mở `RoleRequestsSheet`.
     - Nút "Quản lý công nợ tài xế" mở bảng đối soát COD.
  5. Biểu đồ xu hướng đơn hàng theo giờ trong ngày.
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: gmv, commission, totalOrders, activeDrivers, stalledOrdersCount, pendingRoleRequestsCount.
- **Các trạng thái đã xử lý**: Tự động cập nhật số liệu theo chu kỳ, Bấm vào cảnh báo đơn kẹt chuyển thẳng sang tab đơn hàng với bộ lọc `stalledOnly=true`.
- **Thao tác bấm được và đích đến**:
  - Bấm cảnh báo đơn kẹt -> `navigation.navigate('AdminOrdersTab', { stalledOnly: true })`.
  - Bấm yêu cầu đối tác -> mở bảng trượt duyệt hồ sơ.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tổng quan"`, `"Trung tâm quản trị hệ thống"`, `"Đơn hàng cần can thiệp"`, `"Duyệt đối tác"`.

---

### 14. AdminOrdersScreen (AdminOrdersTab) — Giám sát & can thiệp đơn hàng
- **Tên màn hình**: `AdminOrdersScreen`.
- **Tên route**: `'AdminOrdersTab'` trong `AdminTabParamList` (`mobile/src/navigation/AdminTabNavigator.tsx` dòng 18, 31).
- **Đường dẫn file**: `mobile/src/screens/admin/AdminOrdersScreen.tsx` (439 dòng).
- **Vai trò**: Quản trị viên hệ thống.
- **Mục đích**: Theo dõi mọi đơn hàng trên toàn bộ hệ thống; lọc đơn bị kẹt, huỷ đơn cưỡng chế hoặc gỡ tài xế (unassign driver) khi có sự cố.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Đơn hàng hệ thống", thanh tìm kiếm theo mã đơn / tên quán / tên khách.
  2. Nút công tắc lọc nhanh: "Chỉ hiện đơn bị kẹt (Stalled Orders)" kèm chấm đỏ cảnh báo.
  3. Thanh tab lọc trạng thái đầy đủ các trạng thái đơn.
  4. Danh sách các thẻ đơn hàng chi tiết:
     - Mã đơn, thời gian, trạng thái.
     - Tên khách hàng & SĐT khách.
     - Tên nhà hàng & Địa chỉ quán.
     - Tên tài xế phụ trách (nếu có).
     - Cảnh báo thời gian trễ (ví dụ: "Đã quá 20 phút quán chưa nhận đơn").
     - Hàng nút can thiệp khẩn cấp: Nút "Gỡ tài xế" (để hệ thống điều phối tài xế khác), Nút "Huỷ đơn cưỡng chế" (kèm nhập lý do huỷ).
  5. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: orderId, status, createdAt, customer, restaurant, driver, total, isStalled, stalledReason.
- **Các trạng thái đã xử lý**: Can thiệp huỷ đơn, Can thiệp gỡ tài xế, Lọc đơn kẹt theo query param từ Dashboard.
- **Thao tác bấm được và đích đến**: Bấm nút can thiệp -> gọi API Admin Orders Override.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đơn hàng hệ thống"`, `"Chỉ hiện đơn bị kẹt"`, `"Gỡ tài xế"`, `"Huỷ đơn cưỡng chế"`.

---

### 15. AdminUsersScreen (AdminUsersTab) — Quản lý người dùng & duyệt đối tác
- **Tên màn hình**: `AdminUsersScreen`.
- **Tên route**: `'AdminUsersTab'` trong `AdminTabParamList` (`mobile/src/navigation/AdminTabNavigator.tsx` dòng 19, 32).
- **Đường dẫn file**: `mobile/src/screens/admin/AdminUsersScreen.tsx` (384 dòng).
- **Vai trò**: Quản trị viên hệ thống.
- **Mục đích**: Quản lý danh sách toàn bộ tài khoản người dùng, lọc theo vai trò (Khách, Tài xế, Quán, Admin), khoá/mở khoá tài khoản, duyệt hồ sơ tài xế (`DriverVerifySheet`) và duyệt yêu cầu nâng cấp vai trò (`RoleRequestsSheet`).
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Người dùng", ô tìm kiếm người dùng theo tên/email/SĐT.
  2. Nút lối tắt: "Yêu cầu nâng cấp vai trò đang chờ ([số lượng])" mở `RoleRequestsSheet`.
  3. Thanh lọc vai trò: Tất cả, Khách hàng, Tài xế, Chủ quán, Quản trị.
  4. Danh sách tài khoản người dùng:
     - Avatar, Họ tên, Username, Email, Số điện thoại.
     - Huy hiệu vai trò (`RoleBadge`).
     - Trạng thái hoạt động (Đang hoạt động / Đã bị khoá).
     - Các nút thao tác: Nút "Khoá / Mở tài khoản", Nút "Xem chi tiết hoạt động" (`UserActivitySheet`), Nút "Duyệt hồ sơ xe" (nếu là tài xế).
  5. Bảng trượt duyệt hồ sơ tài xế (`DriverVerifySheet`): Xem ảnh bằng lái, loại xe, biển số; nút "Phê duyệt" hoặc "Từ chối" (kèm lý do).
  6. Bảng trượt danh sách yêu cầu nâng cấp (`RoleRequestsSheet`): Phê duyệt khách hàng lên làm chủ quán hoặc tài xế.
  7. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: id, fullName, username, email, phone, role, isActive, createdAt, driverProfile.
- **Các trạng thái đã xử lý**: Khoá/mở khoá người dùng với xác nhận, Phê duyệt/từ chối hồ sơ đối tác.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Quản lý người dùng"`, `"Duyệt hồ sơ tài xế"`, `"Yêu cầu nâng cấp vai trò"`, `"Khoá tài khoản"`.

---

### 16. AdminRestaurantsScreen (AdminRestaurantsTab) — Quản lý quán ăn & gán chủ quán
- **Tên màn hình**: `AdminRestaurantsScreen`.
- **Tên route**: `'AdminRestaurantsTab'` trong `AdminTabParamList` (`mobile/src/navigation/AdminTabNavigator.tsx` dòng 20, 34).
- **Đường dẫn file**: `mobile/src/screens/admin/AdminRestaurantsScreen.tsx` (464 dòng).
- **Vai trò**: Quản trị viên hệ thống.
- **Mục đích**: Quản lý toàn bộ danh sách quán ăn trên sàn; duyệt quán mới, tạm ngưng hoạt động quán, xem chi tiết quán (`RestaurantDetailSheet`) và gán chủ sở hữu quán ăn (`AssignOwnerSheet`).
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Quán ăn", ô tìm kiếm quán ăn theo tên hoặc địa chỉ.
  2. Thanh lọc trạng thái quán: Tất cả, Đang mở, Tạm đóng, Chưa có chủ (`Unassigned`), Chờ duyệt (`Pending`), Bị đình chỉ (`Suspended`).
  3. Danh sách các thẻ quán ăn:
     - Ảnh quán, tên quán, địa chỉ quán, hotline quán.
     - Trạng thái duyệt (`ACTIVE`, `PENDING`, `SUSPENDED`).
     - Thông tin chủ sở hữu (Họ tên + email chủ quán, hoặc nhãn đỏ "Chưa gán chủ quán").
     - Nút "Gán chủ quán" mở `AssignOwnerSheet`.
     - Nút "Duyệt quán" / "Đình chỉ quán".
  4. Bảng trượt gán chủ sở hữu (`AssignOwnerSheet`): Tìm kiếm tài khoản chủ quán và xác nhận gán quyền sở hữu nhà hàng.
  5. Bảng trượt chi tiết nhà hàng (`RestaurantDetailSheet`): Xem thống kê doanh số, số món trong thực đơn, toạ độ ghim bản đồ.
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: id, name, address, phone, status, isOpen, owner (fullName, email), rating, totalOrders.
- **Các trạng thái đã xử lý**: Đổi trạng thái nhà hàng, Gán chủ nhà hàng thành công.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Quán ăn hệ thống"`, `"Chưa gán chủ quán"`, `"Gán chủ quán"`, `"Đình chỉ hoạt động"`.

---

### 17. AdminProfileScreen (AdminProfileTab) — Cài đặt hệ thống & hồ sơ Admin
- **Tên màn hình**: `AdminProfileScreen`.
- **Tên route**: `'AdminProfileTab'` trong `AdminTabParamList` (`mobile/src/navigation/AdminTabNavigator.tsx` dòng 21, 38).
- **Đường dẫn file**: `mobile/src/screens/admin/AdminProfileScreen.tsx` (130 dòng).
- **Vai trò**: Quản trị viên hệ thống.
- **Mục đích**: Quản lý thông tin tài khoản quản trị, xem cấu hình hệ thống (bản đồ, thông báo, thời gian đánh giá, tỷ lệ hoa hồng) và đăng xuất.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề "Hệ thống", dòng phụ hiển thị chức danh Quản trị viên.
  2. Thẻ hồ sơ quản trị: Avatar, Họ tên, Email, Huy hiệu màu đỏ `Quản trị viên`.
  3. Khối thông tin cấu hình nền tảng (Platform Configurations - chỉ đọc):
     - Nhà cung cấp bản đồ hiện tại: `Goong Map` (hoặc `Nominatim Map`).
     - Thời hạn đánh giá đơn hàng: `7 ngày`.
     - Tỷ lệ hoa hồng sàn mặc định: `20%`.
     - Hạn mức nợ tiền mặt COD tối đa cho tài xế: `2.000.000 ₫`.
  4. Khối tiện ích:
     - Dòng `ListRow`: "Thông tin cá nhân & Đổi mật khẩu" -> `EditProfileScreen`.
  5. Nút "Đăng xuất" (`Button variant="dangerSoft"`).
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: fullName, email, role, mapProvider, reviewWindowDays, commissionRate, debtLimit.
- **Các trạng thái đã xử lý**: Hộp thoại xác nhận đăng xuất.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Hệ thống"`, `"Quản trị viên hệ thống"`, `"Thông tin cấu hình nền tảng"`, `"Đăng xuất"`.

