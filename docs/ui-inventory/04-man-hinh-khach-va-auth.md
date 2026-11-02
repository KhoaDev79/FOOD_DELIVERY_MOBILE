# Phụ lục 04 — Kiểm kê màn hình Khách hàng, Xác thực & Khởi động (mục 6.1)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md) | [Sang Phụ lục 05: Tài xế, Chủ quán, Quản trị →](05-man-hinh-tai-xe-chu-quan-admin.md)

Phụ lục này kiểm kê chi tiết toàn bộ các màn hình dành cho Khách hàng (Customer), luồng Khởi động (Splash/Intro) và Xác thực tài khoản (Auth) trong ứng dụng di động ZomZom.

---

## Danh mục màn hình (20 màn hình & hộp thoại)

1. [ZomZomSplashScreen & SplashLogo — Khởi động ứng dụng](#1-zomzomsplashscreen--splashlogo--khởi-động-ứng-dụng)
2. [LoginScreen — Đăng nhập](#2-loginscreen--đăng-nhập)
3. [RegisterScreen — Đăng ký](#3-registerscreen--đăng-ký)
4. [HomeScreen (HomeTab) — Trang chủ khách hàng](#4-homescreen-hometab--trang-chủ-khách-hàng)
5. [SearchScreen — Tìm kiếm món ăn & quán ăn](#5-searchscreen--tìm-kiếm-món-ăn--quán-ăn)
6. [RestaurantDetailScreen — Chi tiết nhà hàng & Thực đơn](#6-restaurantdetailscreen--chi-tiết-nhà-hàng--thực-đơn)
7. [DishOptionSheet — Bảng chọn tuỳ chọn món (Topping/Size)](#7-dishoptionsheet--bảng-chọn-tuỳ-chọn-món-toppingsize)
8. [CartScreen — Giỏ hàng](#8-cartscreen--giỏ-hàng)
9. [CheckoutScreen — Xác nhận đơn hàng & Thanh toán](#9-checkoutscreen--xác-nhận-đơn-hàng--thanh-toán)
10. [OrderHistoryScreen (OrdersTab) — Lịch sử đơn hàng](#10-orderhistoryscreen-orderstab--lịch-sử-đơn-hàng)
11. [OrderTrackingScreen — Theo dõi đơn hàng thời gian thực](#11-ordertrackingscreen--theo-dõi-đơn-hàng-thời-gian-thực)
12. [FavoritesScreen (FavoritesTab) — Quán ăn yêu thích](#12-favoritesscreen-favoritestab--quán-ăn-yêu-thích)
13. [ProfileScreen (ProfileTab) — Tài khoản cá nhân](#13-profilescreen-profiletab--tài-khoản-cá-nhân)
14. [AddressManagementScreen — Sổ địa chỉ giao hàng](#14-addressmanagementscreen--sổ-địa-chỉ-giao-hàng)
15. [AddAddressScreen — Thêm địa chỉ nhận hàng](#15-addaddressscreen--thêm-địa-chỉ-nhận-hàng)
16. [AddressPickerScreen — Chọn vị trí ghim trên bản đồ](#16-addresspickerscreen--chọn-vị-trí-ghim-trên-bản-đồ)
17. [EditProfileScreen — Chỉnh sửa thông tin cá nhân & Đổi mật khẩu](#17-editprofilescreen--chỉnh-sửa-thông-tin-cá-nhân--đổi-mật-khẩu)
18. [RoleUpgradeRequestScreen — Đăng ký Đối tác Quán ăn / Tài xế](#18-roleupgraderequestscreen--đăng-ký-đối-tác-quán-ăn--tài-xế)
19. [RatingScreen — Đánh giá đơn hàng & Tài xế](#19-ratingscreen--đánh-giá-đơn-hàng--tài-xế)
20. [InboxScreen & ChatScreen — Hộp thư & Nhắn tin đơn hàng (Khách)](#20-inboxscreen--chatscreen--hộp-thư--nhắn-tin-đơn-hàng-khách)

---

### 1. ZomZomSplashScreen & SplashLogo — Khởi động ứng dụng
- **Tên màn hình**: `ZomZomSplashScreen` (kèm `SplashLogo`).
- **Tên route**: Không có route riêng; được gọi trực tiếp có điều kiện trong `mobile/src/navigation/AppNavigator.tsx` (dòng 26–28) khi `showSplash === true`.
- **Đường dẫn file**: `mobile/src/screens/intro/ZomZomSplashScreen.tsx` (182 dòng), `mobile/src/screens/intro/SplashLogo.tsx` (151 dòng).
- **Vai trò**: Dùng chung cho mọi đối tượng khi vừa mở app.
- **Mục đích**: Hiển thị màn hình chào mừng (Splash / Intro), chạy hoạt hình logo nhận diện thương hiệu ZomZom, nạp dữ liệu nền và thanh tiến trình trước khi vào app chính.
- **Bố cục từ trên xuống**:
  1. Nền toàn màn hình: `Gradient preset="splash"` (`linear-gradient(180deg, brand-900 0%, brand-700 55%, brand-700 100%)`).
  2. Vùng trung tâm: Quầng sáng `Gradient preset="splashGlow"`, Logo `SplashLogo` với hoạt hình nảy (bounce/spring), biểu tượng chữ Z nghiêng vẽ bằng View code thuần, chấm tròn cam điểm nhấn.
  3. Tiêu đề thương hiệu: `Text` font `font-display` cỡ `text-[42px]` "ZomZom".
  4. Khối nội dung xoay vòng (slides): 3 thông điệp giới thiệu hiển thị theo nhịp hoạt hình chuyển động chữ.
  5. Thanh tiến trình dưới cùng: Vạch tiến trình chạy từ 0% đến 100% kèm icon xe máy giao hàng di chuyển theo vạch.
  6. Nút bấm: Nút "Bỏ qua" (`Skip`) ở góc trên bên phải (`SafeAreaView`).
- **Các trường dữ liệu hiển thị**: Tỷ lệ % tiến trình (`progress`).
- **Các trạng thái đã xử lý**: Hoàn tất đếm thời gian hoặc bấm bỏ qua -> kích hoạt callback `onFinish()`.
- **Thao tác bấm được và đích đến**:
  - Bấm "Bỏ qua" -> `onFinish()` -> Chuyển sang màn hình chính hoặc màn hình theo vai trò đăng nhập.
- **Chuỗi chữ tĩnh quan trọng**:
  - Tiêu đề thương hiệu: `"ZomZom"`.
  - Thông điệp 1: `"Giao nhanh món ngon trong 30 phút"`.
  - Thông điệp 2: `"Ứng dụng đặt đồ ăn số 1 cho người sành ăn"`.
  - Thông điệp 3: `"Tối ưu lộ trình giao hàng thời gian thực"`.
  - Nút: `"Bỏ qua"`.
- **Nhận xét khách quan**:
  - Màn hình splash vẽ logo và biểu tượng hoàn toàn bằng React Native View + Tailwind CSS (không có tệp ảnh logo `.png` hay `.svg` trong thư mục assets).
  - Có lớp kích thước tuỳ ý `text-[42px]`, `w-[76px]`, `h-[76px]`, `rounded-[22px]`.
  - Hoạt hình mượt mà nhờ Reanimated 4 (`useAnimatedStyle`, `withSpring`, `withTiming`), tuy nhiên có chú thích kỹ thuật riêng cho iOS: mỗi `Animated.View` chỉ nhận một style hoạt hình để tránh xung đột với NativeWind.

---

### 2. LoginScreen — Đăng nhập
- **Tên màn hình**: `LoginScreen`.
- **Tên route**: `'Login'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 19).
- **Đường dẫn file**: `mobile/src/screens/auth/LoginScreen.tsx` (239 dòng).
- **Vai trò**: Khách vãng lai, Người dùng muốn đăng nhập.
- **Mục đích**: Xác thực người dùng bằng Tên đăng nhập / Email và Mật khẩu; lưu trữ JWT tokens và cập nhật vai trò người dùng trong Zustand store.
- **Bố cục từ trên xuống**:
  1. Thanh điều hướng trên (`TopBar`): Nút đóng / quay lại góc trái.
  2. Đầu trang nhận diện: Logo nhỏ `SplashLogo` (size 52), tiêu đề lớn "Đăng nhập", mô tả "Chào mừng bạn quay lại với ZomZom".
  3. Form nhập liệu:
     - Ô nhập tên đăng nhập / Email (`Input`): icon `person-outline`, có nút xoá nhanh khi có chữ.
     - Ô nhập mật khẩu (`Input`): icon `lock-closed-outline`, nút ẩn/hiện mật khẩu (mắt nhắm/mở) có `hitSlop={12}`.
  4. Quên mật khẩu: Nút văn bản "Quên mật khẩu?" canh phải.
  5. Nút hành động chính: `Button label="Đăng nhập"` kích thước lớn `size="lg"`, hỗ trợ trạng thái `loading`.
  6. Khối chuyển đổi đăng ký: Văn bản "Chưa có tài khoản?" kèm nút "Đăng ký ngay".
  7. Khối tài khoản thử nghiệm nhanh (Quick Demo Accounts): Hàng chip bấm nhanh thông tin tài khoản mẫu cho từng vai trò (`Khách hàng`, `Tài xế`, `Chủ quán`, `Admin`).
- **Các trường dữ liệu hiển thị**: Tên tài khoản, Mật khẩu (dạng che ký tự).
- **Các trạng thái đã xử lý**: Đang gửi dữ liệu đăng nhập (`loading`), Lỗi đăng nhập (Toast đỏ báo sai thông tin / tài khoản bị khoá), Thành công (tự động điều hướng theo vai trò).
- **Thao tác bấm được và đích đến**:
  - Bấm "Đăng nhập" -> gọi API `authApi.login`.
  - Bấm "Đăng ký ngay" -> `navigation.navigate('Register')`.
  - Bấm chip demo -> tự động điền thông tin đăng nhập mẫu.
  - Bấm nút ẩn/hiện mật khẩu -> đảo trạng thái hiển thị text.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đăng nhập"`, `"Chào mừng bạn quay lại với ZomZom"`.
  - `"Tên đăng nhập hoặc Email"`, `"Mật khẩu"`.
  - `"Chưa có tài khoản? "`, `"Đăng ký ngay"`.
  - `"Tài khoản thử nghiệm nhanh"`.
- **Nhận xét khách quan**:
  - Có khối tài khoản demo rất tiện cho việc kiểm thử nhưng cần ẩn đi trong môi trường xuất xưởng (production).
  - Tự động chuyển trực tuyến (`isOnline: true` cho tài xế, `isOpen: true` cho quán) ngay khi đăng nhập thành công.

---

### 3. RegisterScreen — Đăng ký
- **Tên màn hình**: `RegisterScreen`.
- **Tên route**: `'Register'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 20).
- **Đường dẫn file**: `mobile/src/screens/auth/RegisterScreen.tsx` (228 dòng).
- **Vai trò**: Khách vãng lai chưa có tài khoản.
- **Mục đích**: Đăng ký tài khoản khách hàng mới với đầy đủ họ tên, tên đăng nhập, email, số điện thoại và mật khẩu.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Nút quay lại.
  2. Đầu trang: Tiêu đề lớn "Tạo tài khoản", dòng dẫn "Bắt đầu đặt món ngon cùng ZomZom".
  3. Form nhập liệu cuộn (`KeyboardAvoidingView` + `ScrollView`):
     - Ô nhập Họ và tên đầy đủ (`Input`).
     - Ô nhập Tên đăng nhập (`Input`).
     - Ô nhập Email (`Input`).
     - Ô nhập Số điện thoại (`Input` - bàn phím phone-pad).
     - Ô nhập Mật khẩu (`Input` - có nút ẩn/hiện).
     - Ô xác nhận mật khẩu (`Input`).
  4. Điều khoản dịch vụ: Dòng chữ thông báo đồng ý điều khoản dịch vụ và chính sách bảo mật khi bấm đăng ký.
  5. Nút đăng ký: `Button label="Đăng ký tài khoản" size="lg"`.
  6. Chân trang: Dòng chuyển hướng "Đã có tài khoản? Đăng nhập".
- **Các trường dữ liệu hiển thị**: fullName, username, email, phone, password, confirmPassword.
- **Các trạng thái đã xử lý**: Kiểm tra hợp lệ dữ liệu phía client (mật khẩu khớp nhau, SĐT đủ độ dài), Đang xử lý đăng ký, Lỗi từ server (trùng username/email/phone), Đăng ký thành công.
- **Thao tác bấm được và đích đến**:
  - Bấm "Đăng ký tài khoản" -> gọi API `authApi.register`.
  - Bấm "Đăng nhập" -> `navigation.navigate('Login')`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tạo tài khoản"`, `"Bắt đầu đặt món ngon cùng ZomZom"`.
  - `"Bằng việc đăng ký, bạn đồng ý với Điều khoản dịch vụ & Chính sách bảo mật của ZomZom"`.
  - `"Đã có tài khoản? "`, `"Đăng nhập"`.
- **Nhận xét khách quan**:
  - Đã tích hợp đầy đủ trường Số điện thoại và Họ tên, đáp ứng điều kiện tiên quyết của nghiệp vụ đặt hàng (khách hàng bắt buộc có SĐT và tên).

---

### 4. HomeScreen (HomeTab) — Trang chủ khách hàng
- **Tên màn hình**: `HomeScreen`.
- **Tên route**: `'HomeTab'` trong `MainTabParamList` (`mobile/src/types/navigation.ts` dòng 5).
- **Đường dẫn file**: `mobile/src/screens/home/HomeScreen.tsx` (530 dòng).
- **Vai trò**: Khách hàng (đã đăng nhập hoặc chưa đăng nhập).
- **Mục đích**: Màn hình trung tâm để khám phá ẩm thực: hiển thị vị trí nhận hàng hiện tại, thanh tìm kiếm nhanh, banner khuyến mãi xoay vòng, danh mục món ăn, bộ sưu tập "Giật Deal Sốc", gợi ý món ngon và danh sách quán ăn gần tôi.
- **Bố cục từ trên xuống**:
  1. Đầu trang Gradient (`Gradient preset="header"`):
     - Hàng địa chỉ giao hàng: Icon định vị, chữ "Giao đến", tên nhãn địa chỉ và địa chỉ rút gọn, icon mũi tên mở bảng chọn địa chỉ.
     - Thanh tìm kiếm giả lập (`SearchBar` dạng nút bấm): Nhấp vào chuyển ngay sang màn hình tìm kiếm.
  2. Băng chuyền Banner khuyến mãi (`BannerCarousel`): Trượt ngang tự động, có chấm tròn chỉ số trang (pagination dots).
  3. Lưới danh mục nhanh (Categories Grid): Các danh mục món (Cơm, Trà sữa, Phở/Bún, Đồ ăn nhanh, v.v.) với icon tương ứng.
  4. Khối "Giật Deal Sốc" (`FeaturedCarousel` kèm `Gradient preset="dealFrame"`): Thẻ món giảm giá có huy hiệu % giảm, giá gốc gạch ngang và giá khuyến mãi.
  5. Khối "Gợi ý dành cho bạn": Thẻ quán ăn nổi bật kèm điểm sao đánh giá, thời gian giao hàng và khoảng cách.
  6. Khối "Quán gần tôi": Danh sách dọc các quán ăn theo khoảng cách km thực tế.
  7. Khoảng đệm chân trang: `TAB_BAR_CLEARANCE` (`pb-28`) để không bị che bởi `FloatingTabBar`.
- **Các trường dữ liệu hiển thị**: Địa chỉ giao hàng hiện tại, Danh mục, Tên quán, Tên món, Đơn giá, Giá khuyến mãi, Tỷ lệ giảm giá, Đánh giá sao, Khoảng cách km, Thời gian dự kiến.
- **Các trạng thái đã xử lý**: Đang tải dữ liệu (`Skeleton` dạng lưới và hàng), Lỗi kết nối (nút Thử lại), Danh sách rỗng, Kéo xuống để làm mới (`RefreshControl`).
- **Thao tác bấm được và đích đến**:
  - Bấm vào địa chỉ -> mở `AddressManagement` hoặc `AddressPicker`.
  - Bấm vào thanh tìm kiếm -> `navigation.navigate('Search')`.
  - Bấm vào danh mục -> `navigation.navigate('Search', { initialQuery: categoryName })`.
  - Bấm vào thẻ quán -> `navigation.navigate('RestaurantDetail', { restaurantId })`.
  - Bấm vào món deal sốc -> mở thẳng chi tiết quán kèm mở tuỳ chọn món `openDishId`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Giao đến"`, `"Tìm kiếm món ăn, quán ăn..."`.
  - `"Giật Deal Sốc"`, `"Gợi ý dành cho bạn"`, `"Quán gần tôi"`.
  - `"Xem tất cả"`.
- **Nhận xét khách quan**:
  - Sử dụng kết hợp nhiều gradient đẹp mắt (`header`, `dealFrame`, `sectionBrand`).
  - Đã có xử lý tôn trọng cài đặt giảm chuyển động (`useReducedMotion`).
  - Bố cục rất phong phú, tải dữ liệu qua TanStack Query với tính năng cache mượt mà.

---

### 5. SearchScreen — Tìm kiếm món ăn & quán ăn
- **Tên màn hình**: `SearchScreen`.
- **Tên route**: `'Search'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 18).
- **Đường dẫn file**: `mobile/src/screens/search/SearchScreen.tsx` (298 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Tìm kiếm quán ăn và món ăn theo từ khóa, lọc theo danh mục, sắp xếp theo khoảng cách / đánh giá / giá cả, lưu lịch sử tìm kiếm gần đây.
- **Bố cục từ trên xuống**:
  1. Đầu trang: Ô nhập liệu tìm kiếm thật (`TextInput`) kèm icon kính lúp, nút xoá từ khoá (`hitSlop={12}`), nút "Huỷ" quay lại.
  2. Hàng chip bộ lọc (`FilterChip` trượt ngang): Tất cả, Gần tôi, Đánh giá cao, Giảm giá, Miễn phí giao.
  3. Nội dung khi chưa tìm kiếm:
     - Khối "Lịch sử tìm kiếm": Các từ khoá đã tìm trước đó kèm nút xoá lịch sử.
     - Khối "Tìm kiếm phổ biến": Các tag gợi ý xu hướng (Trà sữa, Cơm gà, Bún bò...).
  4. Nội dung kết quả tìm kiếm:
     - Danh sách quán ăn khớp từ khoá (`RestaurantCard`).
     - Danh sách món ăn khớp từ khoá (`DishRow`).
- **Các trường dữ liệu hiển thị**: Tên quán, Tên món, Địa chỉ quán, Điểm đánh giá sao, Số lượng đánh giá, Giá món, Khoảng cách km.
- **Các trạng thái đã xử lý**: Đang gõ (debounce tìm kiếm), Đang tải (`Skeleton`), Không tìm thấy kết quả (`EmptyState`), Lỗi tìm kiếm.
- **Thao tác bấm được và đích đến**:
  - Bấm từ khoá lịch sử / phổ biến -> điền vào ô tìm kiếm.
  - Bấm vào kết quả quán -> `navigation.navigate('RestaurantDetail', { restaurantId })`.
  - Bấm nút Huỷ -> `navigation.goBack()`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tìm quán ăn, món ăn ngon..."`, `"Lịch sử tìm kiếm"`, `"Xoá lịch sử"`.
  - `"Xu hướng tìm kiếm"`, `"Không tìm thấy kết quả phù hợp"`.
- **Nhận xét khách quan**:
  - Có một số cỡ chữ tuỳ ý viết dạng `text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[17px]` thay vì dùng thang chuẩn token (`micro`, `caption`, `body`, `body-lg`). Cần chuẩn hoá khi thiết kế lại.

---

### 6. RestaurantDetailScreen — Chi tiết nhà hàng & Thực đơn
- **Tên màn hình**: `RestaurantDetailScreen`.
- **Tên route**: `'RestaurantDetail'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 21).
- **Đường dẫn file**: `mobile/src/screens/restaurant/RestaurantDetailScreen.tsx` (506 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Hiển thị toàn bộ thông tin nhà hàng (ảnh bìa, tên, địa chỉ, hotline, giờ mở cửa, bán kính phục vụ), danh mục thực đơn và danh sách món ăn để thêm vào giỏ hàng.
- **Bố cục từ trên xuống**:
  1. Ảnh bìa nhà hàng (`AppImage`) kèm các nút thao tác nổi phía trên (Nút quay lại, Nút yêu thích thả tim, Nút chia sẻ).
  2. Khối thông tin quán ăn:
     - Tên nhà hàng (chữ đậm, lớn).
     - Đánh giá sao, số lượng đơn đã bán, khoảng cách km và thời gian dự kiến.
     - Hotline quán kèm nút bấm gọi nhanh.
     - Địa chỉ chi tiết của quán kèm trạng thái mở cửa / ngoài giờ.
     - Cảnh báo nếu vị trí khách nhận hàng vượt quá bán kính phục vụ của quán.
  3. Thanh tab danh mục thực đơn cuộn ngang (Menu Categories Tab).
  4. Danh sách món ăn phân theo từng danh mục: Thẻ món ăn (`DishRow`) có ảnh món, tên món, mô tả, giá tiền và nút "Thêm" (+) màu xanh ngọc.
  5. Bảng trượt chọn tuỳ chọn món (`DishOptionSheet`): Mở lên khi món có size/topping.
  6. Thanh giỏ hàng nổi dưới chân trang (`Floating Cart Bar`): Hiện khi giỏ hàng có món của quán này (Số lượng món, Tổng tạm tính, Nút "Xem giỏ hàng").
- **Các trường dữ liệu hiển thị**: Tên quán, Địa chỉ, Số điện thoại quán, Giờ hoạt động, Trạng thái mở cửa, Bán kính giao hàng km, Tên món, Đơn giá, Ảnh món, Các nhóm tuỳ chọn (Size, Topping, Độ cay).
- **Các trạng thái đã xử lý**: Đang tải dữ liệu quán, Quán tạm đóng cửa / Ngoài giờ phục vụ (hiển thị thông báo), Quán ngoài phạm vi giao hàng, Giỏ hàng trống / Giỏ hàng đang có món.
- **Thao tác bấm được và đích đến**:
  - Bấm tim yêu thích -> gọi API toggle favorites.
  - Bấm gọi hotline quán -> mở ứng dụng gọi điện thoại điện thoại `Linking.openURL('tel:...')`.
  - Bấm nút "+" trên món ăn -> nếu món đơn giản: thêm ngay vào giỏ; nếu món có tuỳ chọn: mở `DishOptionSheet`.
  - Bấm thanh giỏ hàng nổi -> `navigation.navigate('Cart')`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Ngoài giờ mở cửa"`, `"Đang mở cửa"`, `"Bán kính phục vụ"`.
  - `"Quán ở ngoài phạm vi giao hàng đến vị trí hiện tại của bạn"`.
  - `"Xem giỏ hàng"`, `"Thêm vào giỏ"`.
- **Nhận xét khách quan**:
  - Đã tích hợp đầy đủ thông tin quán: hotline, địa chỉ chi tiết, bán kính giao hàng.
  - Thanh giỏ hàng nổi ở chân trang có tính toán khoảng đệm hợp lý, giao diện trực quan.

---

### 7. DishOptionSheet — Bảng chọn tuỳ chọn món (Topping/Size)
- **Tên thành phần**: `DishOptionSheet`.
- **Đường dẫn file**: `mobile/src/components/modules/restaurant/DishOptionSheet.tsx` (172 dòng).
- **Vai trò**: Khách hàng (dạng bảng trượt BottomSheet trong `RestaurantDetailScreen`).
- **Mục đích**: Cho phép khách hàng chọn kích cỡ (Size), chọn thêm topping (chọn nhiều), chọn độ cay và nhập ghi chú cho nhà bếp trước khi đưa vào giỏ hàng.
- **Bố cục từ trên xuống**:
  1. Tay nắm kéo bảng trượt (`handle`) và tiêu đề "Tuỳ chọn món".
  2. Thông tin tóm tắt món: Ảnh thu nhỏ, tên món ăn, giá cơ bản.
  3. Khối chọn Size (ChoiceGroup dạng đơn chọn Radio): Tên size kèm giá phụ thu.
  4. Khối chọn Topping (ChoiceGroup dạng đa chọn Checkbox): Tên topping kèm giá thêm.
  5. Khối chọn độ cay (nếu có): Không cay, Cay vừa, Rất cay.
  6. Ô nhập ghi chú đặc biệt cho quán (`Input` multiline): "Ghi chú cho quán (ít đường, không hành...)".
  7. Bộ tăng giảm số lượng (`QuantityStepper`): Giảm (-) / Số lượng / Tăng (+).
  8. Nút hành động chính: `Button` hiển thị tổng giá tiền động tương ứng với các tuỳ chọn đã chọn: "Thêm vào giỏ hàng • [Số tiền] ₫".
- **Các trường dữ liệu hiển thị**: Tên size, Phụ thu size, Tên topping, Đơn giá topping, Ghi chú, Tổng tiền tính nhẩm tức thời.
- **Các trạng thái đã xử lý**: Bắt buộc chọn size trước khi thêm (nếu món có size), Tính toán tức thời giá tiền theo lựa chọn.
- **Nhận xét khách quan**:
  - Tính năng tính nhẩm giá theo công thức chuẩn hoá khớp hoàn toàn với backend (`linePrice`).
  - Có thanh cuộn giới hạn chiều cao `max-h-[520px]` đảm bảo không bị tràn màn hình trên các thiết bị nhỏ.

---

### 8. CartScreen — Giỏ hàng
- **Tên màn hình**: `CartScreen`.
- **Tên route**: `'Cart'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 22).
- **Đường dẫn file**: `mobile/src/screens/cart/CartScreen.tsx` (177 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Quản lý danh sách các món ăn đang chọn trong giỏ: xem tên quán, thay đổi số lượng, xoá món, xem tổng tiền tạm tính và tiến hành thanh toán.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Giỏ hàng của bạn", nút xoá sạch giỏ hàng góc phải.
  2. Khối thông tin quán ăn đang đặt: Tên quán, địa chỉ quán, icon cửa hàng.
  3. Danh sách các món ăn trong giỏ (`CartItem`):
     - Tên món, tuỳ chọn đã chọn (Size, Topping, Ghi chú).
     - Đơn giá và thành tiền của dòng món.
     - Bộ tăng giảm số lượng (`QuantityStepper`): Bấm giảm về 0 sẽ hỏi xác nhận xoá món khỏi giỏ.
  4. Nút bấm "Thêm món khác từ quán này": Quay lại chi tiết quán để chọn thêm món.
  5. Khối tổng quan tài chính dưới chân trang:
     - Tạm tính tiền món ăn.
     - Dòng nhắc nhở phí vận chuyển sẽ được tính toán ở bước tiếp theo.
     - Nút lớn `Button label="Tiến hành thanh toán"` kèm tổng tiền tạm tính.
- **Các trường dữ liệu hiển thị**: Tên nhà hàng, Tên món, Chi tiết size/topping, Ghi chú món, Số lượng món, Đơn giá, Tạm tính tổng cộng.
- **Các trạng thái đã xử lý**: Giỏ hàng trống (`EmptyState` với nút "Khám phá món ngon"), Đổi nhà hàng (cảnh báo xác nhận xoá món của quán cũ khi thêm món quán mới).
- **Thao tác bấm được và đích đến**:
  - Bấm "Khám phá món ngon" -> về `MainTabs` (`HomeTab`).
  - Bấm "Tiến hành thanh toán" -> nếu chưa đăng nhập: chuyển `Login`; nếu đã đăng nhập: chuyển `Checkout`.
  - Bấm "Xoá giỏ hàng" -> hiển thị hộp thoại xác nhận `ConfirmDialog`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Giỏ hàng của bạn"`, `"Giỏ hàng đang trống"`, `"Xoá tất cả"`.
  - `"Phí giao hàng sẽ được tính ở bước thanh toán"`.
  - `"Tiến hành thanh toán"`.
- **Nhận xét khách quan**:
  - Xử lý mượt mà việc bảo toàn chỉ đặt món từ 1 quán duy nhất tại một thời điểm.

---

### 9. CheckoutScreen — Xác nhận đơn hàng & Thanh toán
- **Tên màn hình**: `CheckoutScreen`.
- **Tên route**: `'Checkout'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 23).
- **Đường dẫn file**: `mobile/src/screens/checkout/CheckoutScreen.tsx` (691 dòng).
- **Vai trò**: Khách hàng đã đăng nhập.
- **Mục đích**: Xác nhận toàn bộ thông tin đơn hàng trước khi đặt: kiểm tra thông tin người nhận (tên, SĐT), địa chỉ giao hàng, kiểm tra thông tin quán (tên, SĐT, địa chỉ), nhận báo giá phí giao từ server, chọn hình thức thanh toán (Tiền mặt / VNPay) và gửi đơn.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Xác nhận đơn hàng", nút quay lại.
  2. Khối "Giao đến":
     - Địa chỉ nhận hàng hiện tại, khoảng cách và thời gian dự kiến.
     - Thông tin người nhận: Họ tên + Số điện thoại người nhận.
     - Nút "Đổi / Thêm địa chỉ" mở bảng trượt chọn địa chỉ.
     - Khung cảnh báo màu vàng nổi bật nếu tài khoản thiếu SĐT hoặc họ tên kèm nút "Cập nhật".
  3. Khối "Món đã chọn" kèm số lượng món:
     - Thông tin quán ăn: Tên quán, Hotline quán, Địa chỉ quán chi tiết.
     - Danh sách từng món ăn kèm số lượng, tuỳ chọn và thành tiền.
     - Nút "Thêm món" mở lại chi tiết quán.
  4. Khối "Ghi chú cho tài xế / quán": Ô nhập ghi chú đơn hàng.
  5. Khối "Phương thức thanh toán":
     - Tuỳ chọn "Tiền mặt khi nhận hàng (COD)" (mặc định).
     - Tuỳ chọn "Cổng thanh toán VNPay".
  6. Khối "Chi tiết thanh toán":
     - Tiền món (Tạm tính).
     - Phí vận chuyển (kèm số km).
     - Phụ phí giờ cao điểm (nếu có).
     - Giảm giá khuyến mãi (nếu có).
     - Tổng cộng thanh toán (chữ số lớn, màu xanh ngọc thương hiệu).
  7. Nút đặt đơn dưới cùng: `Button label="Đặt đơn"` hiển thị tổng tiền, có hiệu ứng `loading`.
- **Các trường dữ liệu hiển thị**: Tên người nhận, SĐT người nhận, Địa chỉ giao hàng, Tên quán, SĐT quán, Địa chỉ quán, Khoảng cách km, Phí giao hàng, Tạm tính, Tổng cộng.
- **Các trạng thái đã xử lý**:
  - Kiểm tra ràng buộc bắt buộc SĐT (tối thiểu 9 số) và Họ tên -> chặn đặt đơn và dẫn sang `EditProfile`.
  - Chưa có địa chỉ giao hàng -> chặn đặt đơn và dẫn sang `AddAddress`.
  - Đang tính báo giá đơn (`quoteLoading`), Lỗi báo giá / Quán tạm ngưng nhận đơn (`quoteError`).
  - Món ăn trong giỏ đã hết hàng (`unavailableItemIds`) kèm nút "Xoá các món hết hàng khỏi giỏ".
  - Thay đổi tổng tiền khi backend tính lại giá -> hiển thị `ConfirmDialog` xác nhận giá mới.
- **Thao tác bấm được và đích đến**:
  - Bấm "Cập nhật" SĐT -> `navigation.navigate('EditProfile')`.
  - Bấm "Đổi địa chỉ" -> mở `AddressPickerSheet`.
  - Bấm "Đặt đơn" -> gọi API `ordersApi.create` kèm Idempotency-Key chống trùng đơn -> thành công chuyển sang `OrderTrackingScreen`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Xác nhận đơn hàng"`, `"Giao đến"`, `"Món đã chọn"`.
  - `"Người nhận: [Họ tên] · [SĐT]"`.
  - `"Chưa có SĐT người nhận. Chạm để bổ sung ngay."`.
  - `"Hotline: [SĐT quán]"`, `"Địa chỉ: [Địa chỉ quán]"`.
  - `"Tiền mặt khi nhận hàng (COD)"`, `"Thanh toán VNPay"`.
  - `"Đặt đơn"`.
- **Nhận xét khách quan**:
  - Màn hình được hoàn thiện rất chặt chẽ, đáp ứng chính xác 100% các tiêu chuẩn kiểm tra thông tin và hiển thị minh bạch toàn bộ dữ liệu 3 bên (Khách - Quán - Tài xế).

---

### 10. OrderHistoryScreen (OrdersTab) — Lịch sử đơn hàng
- **Tên màn hình**: `OrderHistoryScreen`.
- **Tên route**: `'OrdersTab'` trong `MainTabParamList` (`mobile/src/types/navigation.ts` dòng 6).
- **Đường dẫn file**: `mobile/src/screens/order/OrderHistoryScreen.tsx` (245 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Quản lý toàn bộ danh sách đơn hàng đã đặt của khách, lọc theo trạng thái đơn, xem tóm tắt thông tin đơn và bấm mở chi tiết theo dõi.
- **Bố cục từ trên xuống**:
  1. Đầu trang `TabHeader`: Tiêu đề lớn "Đơn hàng của bạn", dòng phụ "Theo dõi và quản lý các đơn đặt món".
  2. Thanh lọc trạng thái (`FilterBar` / `FilterChip`):
     - Tất cả.
     - Đang xử lý (`PENDING`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`).
     - Hoàn thành (`DELIVERED`).
     - Đã huỷ / Thất bại (`CANCELLED`, `DELIVERY_FAILED`).
  3. Danh sách thẻ đơn hàng (`OrderCard`):
     - Mã đơn `#XXXXX` kèm ngày giờ đặt.
     - Huy hiệu trạng thái đơn (`OrderStatusBadge`).
     - Tên nhà hàng, địa chỉ giao hàng.
     - Tóm tắt danh sách món đã đặt (`2x Cơm sườn, 1x Trà chanh...`).
     - Tổng tiền đơn hàng, hình thức thanh toán.
     - Các nút thao tác nhanh: Nút "Theo dõi đơn" (nếu đang giao), Nút "Đánh giá" (nếu đã giao xong chưa đánh giá), Nút "Đặt lại".
  4. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: Mã đơn, Ngày giờ tạo, Trạng thái đơn, Tên nhà hàng, Danh sách món tóm tắt, Tổng tiền, Trạng thái thanh toán.
- **Các trạng thái đã xử lý**: Chưa đăng nhập (hiển thị nút Đăng nhập), Đang tải dữ liệu, Danh sách rỗng (`EmptyState`), Kéo làm mới (`RefreshControl`).
- **Thao tác bấm được và đích đến**:
  - Bấm vào thẻ đơn -> `navigation.navigate('OrderTracking', { orderId })`.
  - Bấm "Đánh giá" -> `navigation.navigate('Rating', { orderId, ... })`.
  - Bấm "Đặt lại" -> thêm lại món vào giỏ hàng và mở giỏ.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đơn hàng của bạn"`, `"Theo dõi và quản lý các đơn đặt món"`.
  - `"Chưa có đơn hàng nào"`, `"Khám phá món ngon ngay"`.
- **Nhận xét khách quan**:
  - Sử dụng chung `TabHeader` gradient xanh ngọc đồng bộ với toàn app.

---

### 11. OrderTrackingScreen — Theo dõi đơn hàng thời gian thực
- **Tên màn hình**: `OrderTrackingScreen`.
- **Tên route**: `'OrderTracking'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 24).
- **Đường dẫn file**: `mobile/src/screens/order/OrderTrackingScreen.tsx` (570 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Theo dõi hành trình giao món theo thời gian thực: bản đồ GPS hiển thị vị trí Quán - Tài xế - Khách, thanh tiến trình các bước đơn hàng, thẻ liên hệ tài xế, thẻ liên hệ nhà hàng và nút trò chuyện trực tiếp (Chat).
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Theo dõi đơn hàng #XXXXX", nút quay lại.
  2. Khối Bản đồ tương tác (`AppMapView`):
     - Ghim vị trí quán ăn (icon cửa hàng đỏ).
     - Ghim vị trí khách nhận (icon nhà xanh ngọc).
     - Ghim vị trí tài xế đang di chuyển (icon tài xế cập nhật liên tục qua Socket.IO `driver:location`).
  3. Thanh bước tiến trình đơn hàng (Step Progress Bar):
     - 4 bước: 1. Đặt đơn -> 2. Quán nhận -> 3. Đang giao -> 4. Đã giao.
     - Thời gian giao hàng dự kiến (Estimated Delivery Time).
  4. Thẻ thông tin Tài xế (khi đã có tài xế nhận):
     - Avatar chữ cái đầu, Họ và tên tài xế.
     - Thông tin phương tiện: Dòng xe, hãng xe, Biển số xe.
     - Số điện thoại tài xế.
     - Nút "Nhắn tin" -> Mở màn hình `Chat` với tài xế.
     - Nút "Gọi điện" -> Gọi điện trực tiếp cho tài xế.
  5. Khối nếu đang tìm tài xế: Icon kính lúp xoay, dòng chữ "Đang tìm tài xế gần quán...".
  6. Khối "Địa chỉ nhận hàng":
     - Thông tin người nhận: Họ tên + Số điện thoại người nhận.
     - Địa chỉ nhận hàng chi tiết và Ghi chú đơn.
  7. Khối "Chi tiết đơn hàng":
     - Tên quán ăn, Địa chỉ chi tiết của quán ăn.
     - Nút "Gọi quán" và Nút "Nhắn tin quán".
     - Danh sách từng món, số lượng, thành tiền.
     - Tạm tính, Phí giao hàng, Tổng cộng thanh toán.
  8. Khối Đánh giá (nếu đơn đã giao xong và trong thời hạn đánh giá): Nút bấm mở màn hình chấm sao.
  9. Nút Huỷ đơn hàng (chỉ khả dụng khi đơn còn ở trạng thái `PENDING`).
- **Các trường dữ liệu hiển thị**: Tọa độ GPS 3 bên, Mã đơn, Trạng thái đơn, Tên & SĐT & Xe tài xế, Tên & SĐT & Địa chỉ quán, Tên & SĐT & Địa chỉ khách, Tiền món, Phí giao, Tổng tiền.
- **Các trạng thái đã xử lý**: Kết nối phòng socket đơn `order:join`, Cập nhật toạ độ GPS tài xế thời gian thực, Cập nhật trạng thái tự động qua socket, Đơn bị huỷ / giao thất bại.
- **Thao tác bấm được và đích đến**:
  - Bấm nút gọi tài xế / quán -> gọi điện thoại thực tế qua `Linking.openURL('tel:...')`.
  - Bấm nút nhắn tin tài xế -> `navigation.navigate('Chat', { orderId, recipientName: order.driver.fullName, recipientRole: 'Tài xế giao hàng' })`.
  - Bấm nút nhắn tin quán -> `navigation.navigate('Chat', { orderId, recipientName: order.restaurant.name, recipientRole: 'Quán ăn' })`.
  - Bấm "Đánh giá dịch vụ" -> `navigation.navigate('Rating', { orderId, ... })`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Theo dõi đơn hàng"`, `"Đang tìm tài xế gần quán..."`.
  - `"Địa chỉ nhận hàng"`, `"Chi tiết đơn hàng"`.
  - `"Gọi"`, `"Nhắn tin"`.
- **Nhận xét khách quan**:
  - Hiển thị đầy đủ, chính xác toàn bộ thông tin của cả 3 chủ thể: Quán ăn (tên, SĐT, địa chỉ chi tiết), Tài xế (tên, SĐT, biển số, dòng xe) và Khách hàng (tên, SĐT, địa chỉ nhận).
  - Tích hợp 2 kênh liên lạc song song: Gọi điện thoại GSM truyền thống và Nhắn tin trực tiếp trong app qua Socket.IO.

---

### 12. FavoritesScreen (FavoritesTab) — Quán ăn yêu thích
- **Tên màn hình**: `FavoritesScreen`.
- **Tên route**: `'FavoritesTab'` trong `MainTabParamList` (`mobile/src/types/navigation.ts` dòng 7).
- **Đường dẫn file**: `mobile/src/screens/favorites/FavoritesScreen.tsx` (153 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Danh sách các quán ăn mà khách hàng đã thả tim yêu thích; đồng bộ dữ liệu với server theo tài khoản.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề lớn "Quán yêu thích", dòng dẫn "Bộ sưu tập những quán quen của bạn".
  2. Danh sách các quán ăn yêu thích: Dạng thẻ ngang/dọc hiển thị ảnh quán, tên quán, điểm đánh giá sao, khoảng cách km và nút huỷ thả tim.
  3. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: Tên quán, Ảnh đại diện, Đánh giá, Khoảng cách km, Địa chỉ rút gọn.
- **Các trạng thái đã xử lý**: Chưa đăng nhập (hiển thị nút dẫn sang Login), Danh sách rỗng (`EmptyState` kèm nút "Khám phá quán ngon"), Đang tải dữ liệu.
- **Thao tác bấm được và đích đến**:
  - Bấm vào quán -> `navigation.navigate('RestaurantDetail', { restaurantId })`.
  - Bấm huỷ tim -> loại bỏ khỏi danh sách yêu thích tức thời.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Quán yêu thích"`, `"Bộ sưu tập những quán quen của bạn"`.
  - `"Chưa có quán yêu thích nào"`, `"Khám phá quán ngon"`.

---

### 13. ProfileScreen (ProfileTab) — Tài khoản cá nhân
- **Tên màn hình**: `ProfileScreen`.
- **Tên route**: `'ProfileTab'` trong `MainTabParamList` (`mobile/src/types/navigation.ts` dòng 8).
- **Đường dẫn file**: `mobile/src/screens/profile/ProfileScreen.tsx` (246 dòng).
- **Vai trò**: Khách hàng (hoặc khách chưa đăng nhập).
- **Mục đích**: Trung tâm quản lý tài khoản người dùng: thông tin cá nhân, lối tắt tới Sổ địa chỉ, Hộp thư tin nhắn, Đăng ký đối tác và Đăng xuất.
- **Bố cục từ trên xuống**:
  1. `TabHeader`: Tiêu đề lớn "Tài khoản", dòng phụ hiển thị chức danh hoặc email.
  2. Thẻ hồ sơ người dùng (User Card):
     - Avatar tròn (chữ cái đầu hoặc ảnh đại diện).
     - Họ và tên người dùng, Số điện thoại người dùng, Email.
     - Nút "Chỉnh sửa" dẫn sang `EditProfileScreen`.
  3. Khối tiện ích dịch vụ:
     - Dòng `ListRow`: "Hộp thư tin nhắn" (kèm số đếm tin chưa đọc) -> `InboxScreen`.
     - Dòng `ListRow`: "Sổ địa chỉ nhận hàng" -> `AddressManagementScreen`.
     - Dòng `ListRow`: "Đăng ký mở quán / làm tài xế" -> `RoleUpgradeRequestScreen`.
  4. Khối cài đặt & chính sách:
     - Dòng `ListRow`: "Chính sách & Điều khoản dịch vụ".
     - Dòng `ListRow`: "Thông tin ứng dụng (Phiên bản 1.0.0)".
  5. Nút "Đăng xuất": `Button variant="dangerSoft"` màu đỏ nhạt kèm hộp thoại xác nhận `ConfirmDialog`.
  6. Khoảng đệm chân trang `TAB_BAR_CLEARANCE` (`pb-28`).
- **Các trường dữ liệu hiển thị**: Họ và tên, Email, Số điện thoại, Vai trò hiện tại, Số lượng tin nhắn chưa đọc, Phiên bản app.
- **Các trạng thái đã xử lý**: Chưa đăng nhập (hiển thị banner mời đăng nhập/đăng ký), Đã đăng nhập, Hộp thoại xác nhận đăng xuất.
- **Thao tác bấm được và đích đến**:
  - Bấm "Chỉnh sửa" -> `navigation.navigate('EditProfile')`.
  - Bấm "Hộp thư tin nhắn" -> `navigation.navigate('Inbox')`.
  - Bấm "Sổ địa chỉ" -> `navigation.navigate('AddressManagement')`.
  - Bấm "Đăng ký mở quán / tài xế" -> `navigation.navigate('RoleUpgradeRequest')`.
  - Bấm "Đăng xuất" -> xoá token, làm sạch cache và chuyển về trạng thái khách vãng lai.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tài khoản"`, `"Thông tin cá nhân & mật khẩu"`.
  - `"Hộp thư tin nhắn"`, `"Sổ địa chỉ nhận hàng"`.
  - `"Đăng ký mở quán / làm tài xế"`, `"Đăng xuất"`.

---

### 14. AddressManagementScreen — Sổ địa chỉ giao hàng
- **Tên màn hình**: `AddressManagementScreen`.
- **Tên route**: `'AddressManagement'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 27).
- **Đường dẫn file**: `mobile/src/screens/profile/AddressManagementScreen.tsx` (236 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Xem danh sách các địa chỉ đã lưu (Nhà riêng, Công ty, Khác), chọn địa chỉ mặc định, chọn địa chỉ đang giao và xoá địa chỉ.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Sổ địa chỉ", nút quay lại.
  2. Nút "Thêm địa chỉ mới": Nút bấm nổi bật trên đầu dẫn sang `AddAddressScreen`.
  3. Danh sách địa chỉ đã lưu:
     - Huy hiệu nhãn địa chỉ (`Nhà`, `Công ty`, `Khác`).
     - Tên người nhận và số điện thoại liên kết với địa chỉ.
     - Dòng địa chỉ chi tiết.
     - Huy hiệu "Mặc định", huy hiệu "Đang chọn".
     - Nút đặt làm mặc định, nút xoá địa chỉ (kèm xác nhận).
- **Các trường dữ liệu hiển thị**: Nhãn địa chỉ, Tên người nhận, SĐT người nhận, Địa chỉ chi tiết, Toạ độ (ngầm).
- **Các trạng thái đã xử lý**: Chưa có địa chỉ nào (`EmptyState`), Đang tải danh sách, Xoá địa chỉ thành công.
- **Thao tác bấm được và đích đến**:
  - Bấm "Thêm địa chỉ mới" -> `navigation.navigate('AddAddress')`.
  - Bấm vào một địa chỉ -> Đặt làm địa chỉ giao hàng hiện tại (`setSelectedAddressId`).
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Sổ địa chỉ"`, `"Thêm địa chỉ mới"`, `"Đặt làm mặc định"`, `"Xoá"`.

---

### 15. AddAddressScreen — Thêm địa chỉ nhận hàng
- **Tên màn hình**: `AddAddressScreen`.
- **Tên route**: `'AddAddress'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 28).
- **Đường dẫn file**: `mobile/src/screens/profile/AddAddressScreen.tsx` (340 dòng).
- **Vai trò**: Khách hàng.
- **Mục đích**: Thêm một địa chỉ nhận hàng mới vào sổ địa chỉ: định vị toạ độ trên bản đồ, nhập số nhà/tên đường chi tiết, chọn loại nhãn (Nhà / Công ty / Khác) và nhập thông tin người nhận.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Thêm địa chỉ mới".
  2. Nút bấm "Chọn vị trí trên bản đồ": Mở `AddressPickerScreen` để ghim toạ độ chính xác.
  3. Khối hiển thị vị trí đã ghim: Dòng toạ độ hoặc địa chỉ địa lý đảo ngược (Reverse geocode).
  4. Form nhập thông tin:
     - Tên người nhận hàng (`Input`).
     - Số điện thoại người nhận hàng (`Input` - bàn phím số).
     - Số nhà, tên toà nhà, ngõ/hẻm chi tiết (`Input`).
     - Ghi chú hướng dẫn giao hàng (vd: Gọi trước khi đến, bấm chuông lầu 2...).
  5. Chọn nhãn địa chỉ: Hàng 3 chip bấm chọn (`Nhà`, `Công ty`, `Khác`).
  6. Công tắc "Đặt làm địa chỉ mặc định": Switch bật/tắt.
  7. Nút hành động: `Button label="Lưu địa chỉ" size="lg"`.
- **Các trường dữ liệu hiển thị**: Tên người nhận, SĐT, Số nhà/đường, Toạ độ lat/lng, Ghi chú, Nhãn.
- **Các trạng thái đã xử lý**: Kiểm tra bắt buộc có toạ độ ghim, bắt buộc có SĐT và số nhà; Đang lưu dữ liệu (`loading`).
- **Thao tác bấm được và đích đến**:
  - Bấm "Chọn vị trí trên bản đồ" -> `navigation.navigate('AddressPicker', { ... })`.
  - Bấm "Lưu địa chỉ" -> gọi API lưu địa chỉ và quay về sổ địa chỉ.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Thêm địa chỉ mới"`, `"Chọn vị trí trên bản đồ"`, `"Lưu địa chỉ"`.

---

### 16. AddressPickerScreen — Chọn vị trí ghim trên bản đồ
- **Tên màn hình**: `AddressPickerScreen`.
- **Tên route**: `'AddressPicker'` trong `RootStackParamList` và `OwnerStackParamList` (`mobile/src/types/navigation.ts` dòng 29, 55).
- **Đường dẫn file**: `mobile/src/screens/profile/AddressPickerScreen.tsx` (456 dòng).
- **Vai trò**: Dùng chung (Khách hàng ghim nhà, Chủ quán ghim toạ độ quán).
- **Mục đích**: Bản đồ toàn màn hình (`AppMapView`) có tâm ghim cố định ở giữa; tự động giải mã toạ độ sang địa chỉ bằng Goong Map / Nominatim và trả kết quả về màn hình trước.
- **Bố cục từ trên xuống**:
  1. Bản đồ tương tác toàn màn hình: Kéo thả, phóng to, thu nhỏ.
  2. Nút quay lại hình tròn góc trên bên trái.
  3. Ghim vị trí (Pin marker) cố định chính giữa màn hình (icon ghim màu xanh ngọc + bóng mờ).
  4. Nút định vị "Vị trí hiện tại của tôi" hình tròn góc phải dưới bản đồ.
  5. Khung thông tin vị trí dưới đáy màn hình (`Bottom Card`):
     - Dòng chữ địa chỉ đã giải mã chi tiết.
     - Dòng toạ độ GPS hiển thị vĩ độ / kinh độ.
     - Nút bấm lớn `Button label="Xác nhận vị trí này"`.
- **Các trường dữ liệu hiển thị**: Địa chỉ giải mã, Kinh độ, Vĩ độ.
- **Các trạng thái đã xử lý**: Đang kéo bản đồ, Đang giải mã toạ độ (`loading`), Lỗi giải mã địa chỉ (sử dụng địa chỉ tạm Heuristic fallback).
- **Thao tác bấm được và đích đến**:
  - Kéo bản đồ -> cập nhật tâm toạ độ và gọi reverse geocoding (có debounce).
  - Bấm "Xác nhận vị trí này" -> trả toạ độ về qua callback hoặc draft store và `navigation.goBack()`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Di chuyển bản đồ để đặt điểm ghim"`, `"Xác nhận vị trí này"`.

---

### 17. EditProfileScreen — Chỉnh sửa thông tin cá nhân & Đổi mật khẩu
- **Tên màn hình**: `EditProfileScreen`.
- **Tên route**: `'EditProfile'` (dùng chung trong cả 4 navigator: Root, Driver, Owner, Admin).
- **Đường dẫn file**: `mobile/src/screens/profile/EditProfileScreen.tsx` (259 dòng).
- **Vai trò**: Dùng chung cho mọi người dùng đã đăng nhập.
- **Mục đích**: Cập nhật Họ và tên, Số điện thoại, Email và đổi Mật khẩu tài khoản.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Thông tin cá nhân & mật khẩu", nút quay lại.
  2. Tab phân chia chức năng: Tab "Thông tin cá nhân" và Tab "Đổi mật khẩu".
  3. Form Thông tin cá nhân:
     - Ô nhập Họ và tên (`Input`).
     - Ô nhập Số điện thoại (`Input` - bắt buộc tối thiểu 9 số để đặt hàng).
     - Ô nhập Email (`Input`).
     - Tên đăng nhập (chế độ chỉ đọc, không cho sửa).
     - Nút "Lưu thay đổi".
  4. Form Đổi mật khẩu:
     - Ô nhập Mật khẩu hiện tại (`Input`).
     - Ô nhập Mật khẩu mới (`Input`).
     - Ô xác nhận Mật khẩu mới (`Input`).
     - Nút "Cập nhật mật khẩu".
- **Các trường dữ liệu hiển thị**: fullName, phone, email, username, currentPassword, newPassword.
- **Các trạng thái đã xử lý**: Kiểm tra hợp lệ dữ liệu, Cập nhật thành công (đồng bộ tức thì vào Zustand `useAuthStore`), Lỗi mật khẩu cũ không đúng.
- **Thao tác bấm được và đích đến**:
  - Bấm "Lưu thay đổi" -> gọi API cập nhật hồ sơ.
  - Bấm "Cập nhật mật khẩu" -> gọi API đổi mật khẩu.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Thông tin cá nhân & mật khẩu"`, `"Lưu thay đổi"`, `"Cập nhật mật khẩu"`.

---

### 18. RoleUpgradeRequestScreen — Đăng ký Đối tác Quán ăn / Tài xế
- **Tên màn hình**: `RoleUpgradeRequestScreen`.
- **Tên route**: `'RoleUpgradeRequest'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 34).
- **Đường dẫn file**: `mobile/src/screens/profile/RoleUpgradeRequestScreen.tsx` (240 dòng).
- **Vai trò**: Khách hàng muốn nâng cấp tài khoản thành Chủ quán ăn hoặc Tài xế giao hàng.
- **Mục đích**: Gửi yêu cầu nâng cấp vai trò lên hệ thống để Quản trị viên (Admin) xét duyệt.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Đăng ký đối tác", nút quay lại.
  2. Hai thẻ chọn loại hình đối tác:
     - Thẻ "Chủ quán ăn (Restaurant Owner)": Icon nhà hàng, mô tả quyền lợi mở quán bán món.
     - Thẻ "Tài xế giao hàng (Driver)": Icon xe máy, mô tả quyền lợi nhận đơn giao hàng kiếm thu nhập.
  3. Form điền thông tin bổ sung:
     - Nếu chọn Quán ăn: Tên quán ăn dự kiến, Địa chỉ quán ăn.
     - Nếu chọn Tài xế: Loại phương tiện (Xe máy, Xe máy điện, Xe đạp), Hãng xe, Dòng xe, Biển số xe.
     - Ghi chú hoặc lời nhắn gửi ban quản trị.
  4. Khối danh sách các yêu cầu trước đó (nếu đã từng gửi): Hiển thị trạng thái yêu cầu (`Chờ duyệt`, `Đã duyệt`, `Bị từ chối`) kèm lý do từ chối nếu có.
  5. Nút gửi: `Button label="Gửi yêu cầu đăng ký" size="lg"`.
- **Các trường dữ liệu hiển thị**: Loại vai trò yêu cầu, Tên quán, Địa chỉ quán, Thông tin xe, Biển số, Trạng thái xét duyệt.
- **Các trạng thái đã xử lý**: Đã có yêu cầu đang chờ duyệt (khoá không cho gửi trùng lặp), Đang gửi dữ liệu, Gửi thành công.
- **Thao tác bấm được và đích đến**:
  - Bấm gửi -> gọi API tạo yêu cầu nâng cấp vai trò.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đăng ký đối tác"`, `"Gia nhập hệ sinh thái ZomZom"`.
  - `"Chủ quán ăn"`, `"Tài xế giao hàng"`.
  - `"Yêu cầu của bạn đang được ban quản trị xét duyệt"`.

---

### 19. RatingScreen — Đánh giá đơn hàng & Tài xế
- **Tên màn hình**: `RatingScreen`.
- **Tên route**: `'Rating'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 35).
- **Đường dẫn file**: `mobile/src/screens/rating/RatingScreen.tsx` (259 dòng).
- **Vai trò**: Khách hàng có đơn vừa hoàn thành.
- **Mục đích**: Chấm điểm số sao (1 đến 5 sao) và để lại nhận xét công khai cho Quán ăn và Tài xế phụ trách đơn hàng.
- **Bố cục từ trên xuống**:
  1. `TopBar`: Tiêu đề "Đánh giá dịch vụ", nút quay lại.
  2. Khối đánh giá Quán ăn:
     - Tên nhà hàng.
     - Hàng 5 ngôi sao chấm điểm tương tác (chạm chọn từ 1 đến 5 sao).
     - Nhãn cảm xúc tương ứng số sao: Rất tệ (1★) -> Tuyệt vời (5★).
     - Ô nhập nhận xét về món ăn & đóng gói (`Input` multiline).
  3. Khối đánh giá Tài xế (nếu đơn có tài xế):
     - Họ và tên tài xế giao hàng.
     - Hàng 5 ngôi sao chấm điểm tài xế.
     - Nhãn cảm xúc đánh giá tài xế (Nhanh nhẹn, thân thiện, bảo quản tốt...).
     - Ô nhập nhận xét về tài xế (`Input` multiline).
  4. Nút hành động: `Button label="Gửi đánh giá" size="lg"`.
- **Các trường dữ liệu hiển thị**: restaurantRating, restaurantComment, driverRating, driverComment.
- **Các trạng thái đã xử lý**: Kiểm tra bắt buộc chọn tối thiểu 1 sao trước khi gửi; Đang gửi đánh giá; Đã gửi thành công -> quay lại trang theo dõi.
- **Thao tác bấm được và đích đến**:
  - Bấm chọn sao -> cập nhật state rating.
  - Bấm "Gửi đánh giá" -> gọi API `ordersApi.review`.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Đánh giá dịch vụ"`, `"Chất lượng món ăn thế nào?"`, `"Dịch vụ giao hàng của tài xế"`.
  - `"Gửi đánh giá"`.

---

### 20. InboxScreen & ChatScreen — Hộp thư & Nhắn tin đơn hàng (Khách)
- **Tên màn hình**: `InboxScreen` (Hộp thư danh sách hội thoại) và `ChatScreen` (Màn hình nhắn tin trực tiếp).
- **Tên route**: `'Inbox'` và `'Chat'` trong `RootStackParamList` (`mobile/src/types/navigation.ts` dòng 26, 36).
- **Đường dẫn file**: `mobile/src/screens/chat/InboxScreen.tsx` (329 dòng), `mobile/src/screens/chat/ChatScreen.tsx` (296 dòng).
- **Vai trò**: Khách hàng (và các bên tham gia đơn hàng).
- **Mục đích**:
  - `InboxScreen`: Hiển thị danh sách các đơn hàng có cuộc hội thoại, số tin nhắn chưa đọc, tin nhắn mới nhất và thời gian.
  - `ChatScreen`: Phòng trò chuyện trực tiếp 3 bên theo từng đơn hàng qua Socket.IO và REST API.
- **Bố cục từ trên xuống**:
  - **InboxScreen**:
    1. `TopBar`: Tiêu đề "Tin nhắn đơn hàng".
    2. Danh sách các cuộc trò chuyện: Mỗi dòng hiển thị mã đơn `#XXXXX`, tên quán, tên tài xế, nội dung tin nhắn gần nhất, thời gian, chấm đỏ số lượng tin chưa đọc (`CountBadge`).
  - **ChatScreen**:
    1. `TopBar`: Tiêu đề hiển thị tên người trò chuyện kèm vai trò (`Tài xế` / `Quán ăn`), góc phải có chấm đèn trạng thái kết nối trực tuyến (Xanh lá: Trực tuyến).
    2. Thẻ tóm tắt đơn hàng thu gọn trên đầu (`ChatOrderCard`): Mã đơn, trạng thái đơn, địa chỉ giao.
    3. Vùng danh sách bong bóng chat (`FlatList`):
       - Tin nhắn của tôi: Lệch phải, nền xanh ngọc `bg-brand-500`, chữ trắng, thời gian chữ trắng mờ.
       - Tin nhắn đối phương: Lệch trái, nền trắng `bg-surface`, viền xám, hiển thị họ tên + huy hiệu vai trò (`Khách hàng`, `Tài xế`, `Quán ăn`), nội dung chữ đen.
    4. Thanh gợi ý tin nhắn nhanh (Quick Chips trượt ngang): Các phím tắt tiện lợi như *"Tôi đang đợi ở trước nhà"*, *"Xin chờ tôi 2 phút nhé"*, *"Đã giao đến nơi ạ"*.
    5. Thanh nhập tin nhắn: Ô nhập văn bản đa dòng (`TextInput`), nút gửi tròn màu xanh ngọc có icon máy bay giấy / mũi tên gửi.
- **Các trường dữ liệu hiển thị**: orderId, senderName, senderRole, content, createdAt, isRead, isOnline.
- **Các trạng thái đã xử lý**: Kết nối phòng socket `order:join` / `order:leave`, Nhận tin nhắn mới tức thời qua socket `order:message`, Tự động cuộn xuống cuối danh sách, Đánh dấu đã đọc khi mở hội thoại.
- **Thao tác bấm được và đích đến**:
  - Bấm gửi tin nhắn -> lưu vào database và phát sóng socket tới các bên.
  - Bấm chip tin nhắn nhanh -> tự động điền vào ô nhập.
- **Chuỗi chữ tĩnh quan trọng**:
  - `"Tin nhắn đơn hàng"`, `"Trực tuyến"`, `"Ngoại tuyến"`.
  - `"Tôi đang đợi ở sảnh / trước nhà"`, `"Xin chờ tôi 2 phút nhé"`.
  - `"Nhập tin nhắn..."`.
- **Nhận xét khách quan**:
  - Tính năng chat thời gian thực hoạt động đồng bộ 2 chiều (REST + WebSocket), có lưu trữ lịch sử trong cơ sở dữ liệu (`model OrderMessage`).

