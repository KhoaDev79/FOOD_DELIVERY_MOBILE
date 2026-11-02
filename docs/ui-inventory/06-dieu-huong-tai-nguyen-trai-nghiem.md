# Phụ lục 06 — Khung điều hướng, Tài nguyên, Trải nghiệm & Danh sách vấn đề (mục 7–12)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md) | [Sang Phụ lục 07: Thống kê thô →](07-phu-luc-tho.md)

Phụ lục này tổng hợp chi tiết các quy chuẩn cấu trúc giao diện, tài nguyên tĩnh, chuyển động, khả năng tiếp cận và toàn bộ các điểm bất nhất, vấn đề khách quan được phát hiện từ mã nguồn.

---

## Mục lục

- [7. Khung điều hướng và bố cục chung](#7-khung-điều-hướng-và-bố-cục-chung)
  - [7.1 Thanh tab nổi (FloatingTabBar)](#71-thanh-tab-nổi-floatingtabbar)
  - [7.2 Nút giỏ hàng nổi & Thanh giỏ hàng](#72-nút-giỏ-hàng-nổi--thanh-giỏ-hàng)
  - [7.3 Tiêu đề chuyển màu (TabHeader & Gradient)](#73-tiêu-đề-chuyển-màu-tabheader--gradient)
  - [7.4 Xử lý vùng an toàn và bàn phím](#74-xử-lý-vùng-an-toàn-và-bàn-phím)
- [8. Tài nguyên (Icons, Ảnh, Splash, Logo, Font)](#8-tài-nguyên-icons-ảnh-splash-logo-font)
  - [8.1 Biểu tượng (Icons)](#81-biểu-tượng-icons)
  - [8.2 Hình ảnh và minh hoạ](#82-hình-ảnh-và-minh-hoạ)
  - [8.3 Phông chữ (Typography assets)](#83-phông-chữ-typography-assets)
- [9. Chuyển động (Animations)](#9-chuyển-động-animations)
- [10. Khả năng truy cập (Accessibility)](#10-khả-năng-truy-cập-accessibility)
- [11. Nội dung cứng và dữ liệu mẫu](#11-nội-dung-cứng-và-dữ-liệu-mẫu)
- [12. Danh sách vấn đề và bất nhất khách quan (30 mục)](#12-danh-sách-vấn-đề-và-bất-nhất-khách-quan-30-mục)

---

## 7. Khung điều hướng và bố cục chung

### 7.1 Thanh tab nổi (FloatingTabBar)
Định nghĩa tại `mobile/src/components/ui/FloatingTabBar.tsx` (91 dòng). Được sử dụng ở cả 4 TabNavigator: Khách hàng (`BottomTabNavigator`), Tài xế (`DriverTabNavigator`), Chủ quán (`OwnerTabNavigator`), và Quản trị viên (`AdminTabNavigator`).

| Thuộc tính | Quy cách kỹ thuật trong mã |
|---|---|
| **Vị trí** | Đặt tuyệt đối ở đáy màn hình: `absolute bottom-0 left-0 right-0 pointerEvents="box-none"`. |
| **Bao bọc vùng an toàn** | Bọc ngoài bằng `<SafeAreaView edges={['bottom']}>` tự động điều chỉnh padding theo thanh Home Indicator của iOS và navigation bar của Android. |
| **Chiều cao khung tab** | Lớp `h-tabbar` = **64px** (từ token `size.tabbar = 64` trong `tokens.json`). |
| **Lề ngoài (Margin/Padding)** | `px-4 pb-2 gap-3` (cách 2 mép màn hình 16px, cách đáy 8px). |
| **Bo góc (Radius)** | `rounded-full` (bo tròn dạng viên thuốc con thoi). |
| **Màu nền** | `bg-surface` (`#FFFFFF`). |
| **Bóng đổ (Shadow)** | Lớp `shadow-float` (`0px 10px 30px rgba(0, 0, 0, 0.12)`). |
| **Chỉ báo tab đang chọn** | Khối con thoi nền Gradient `preset="brandPill"` (`linear-gradient(135deg, brand-300 0%, brand-500 100%)`), chiều cao `h-12` (48px), chiều rộng tối đa `max-w-24`, bo góc `rounded-full`, hiệu ứng hào quang `shadow-glow`. |
| **Icon tab không chọn** | `<Icon tone="secondary" size="lg" />` (màu xám `#6B6F76`, kích thước 24px). |
| **Icon tab đang chọn** | `<Icon tone="inverse" size="lg" />` (màu trắng `#FFFFFF`, kích thước 24px). |
| **Huy hiệu số đếm (Badge)** | `<CountBadge count={badge} />` đặt tuyệt đối ở `absolute left-1/2 top-1.5 ml-1.5` trên góc icon, hiển thị số tin nhắn chưa đọc hoặc thông báo. |
| **Khoảng đệm chống che khuất** | Biến số xuất khẩu `TAB_BAR_CLEARANCE = 'pb-28'` (**112px**) được áp dụng vào cuối các danh sách cuộn (`ScrollView`, `FlatList`) trên mọi màn hình tab để nội dung cuối cùng không bị thanh tab che mất. |

### 7.2 Nút giỏ hàng nổi & Thanh giỏ hàng

1. **Nút giỏ hàng tròn tích hợp trên thanh tab khách hàng (`FloatingTabBar.tsx`)**:
   - Chỉ xuất hiện khi có prop `onCartPress` (chỉ có ở `BottomTabNavigator` của Khách hàng; các vai trò Tài xế, Chủ quán, Quản trị không có).
   - Nằm ngay bên phải thanh tab viên thuốc, tách biệt bằng `gap-3`.
   - Kích thước: `h-fab w-fab` = **60px × 60px** (từ token `size.fab = 60`).
   - Nền: `Gradient preset="brandPill"` bo tròn `rounded-full`, bóng đổ phát sáng `shadow-glow`.
   - Icon: `cart-outline` màu trắng, kích cỡ 28px.
   - Huy hiệu số đếm: `<CountBadge count={cartCount} />` màu đỏ điểm nhấn ở góc trên phải `-right-0.5 -top-0.5`.

2. **Thanh giỏ hàng nổi dưới chân trang chi tiết quán (`RestaurantDetailScreen.tsx` dòng 475–505)**:
   - Hiển thị cố định ở chân màn hình khi giỏ hàng có tối thiểu 1 món ăn của quán đang xem (`cartTotalItems > 0 && cartRestaurantId === restaurant.id`).
   - Nền trắng `bg-surface`, viền trên `border-t border-line`, bóng đổ `shadow-float`.
   - Bên trái: Số lượng món đã chọn (`X món`), Tổng tiền tạm tính bằng VND cỡ lớn.
   - Bên phải: Nút `Button label="Xem giỏ hàng"` kích thước `size="md"`, màu xanh ngọc.

### 7.3 Tiêu đề chuyển màu (TabHeader & Gradient)
Định nghĩa tại `mobile/src/components/ui/TabHeader.tsx` (45 dòng) và `mobile/src/components/ui/Gradient.tsx` (47 dòng).

- **Cấu trúc TabHeader**:
  - Khối bọc ngoài: `Gradient preset="tabHeader"` (`linear-gradient(160deg, brand-900 0%, brand-700 55%, brand-500 100%)`).
  - Bo góc dưới: `rounded-b-2xl` (**24px**).
  - Vùng an toàn trên: `<SafeAreaView edges={['top']}>`.
  - Tiêu đề chính: `<Text variant="display" tone="inverse" accessibilityRole="header">` (font chữ đậm, màu trắng).
  - Phụ đề (nếu có): `<Text variant="body" tone="inverse" className="opacity-80">`.
  - Khối con bên dưới (`children`): Cho phép đặt thanh tìm kiếm, thanh lọc chip hoặc thẻ hồ sơ lồng bên trong gradient.
- **Biến thể Gradient theo vai trò**:
  - Khách hàng (Trang chủ): `Gradient preset="header"` chuyển màu dài từ xanh ngọc đậm xuống xanh nhạt rồi hoà vào nền trắng (`brand-900 -> brand-700 -> brand-100 -> canvas.DEFAULT`).
  - Khách hàng (Đơn hàng, Yêu thích, Tài khoản): `Gradient preset="tabHeader"`.
  - Chủ quán (Đơn hàng, Thực đơn, Cửa hàng): Dùng chung `TabHeader` gradient xanh ngọc.
  - Tài xế (Tìm đơn, Chuyến giao, Tài xế): Dùng chung `TabHeader` gradient xanh ngọc.
  - Quản trị viên (Tổng quan, Đơn hàng, Người dùng, Quán ăn, Hệ thống): Dùng chung `TabHeader` gradient xanh ngọc.

### 7.4 Xử lý vùng an toàn và bàn phím
- **Vùng an toàn (Safe Area)**:
  - Nền tảng: `react-native-safe-area-context` phiên bản `~5.10.1`.
  - Đăng ký `cssInterop` tại `mobile/src/theme/interop.ts` cho `SafeAreaProvider` và `SafeAreaView` để hỗ trợ lớp `className`.
  - Điểm gốc: `mobile/App.tsx` bọc toàn app trong `<SafeAreaProvider className="flex-1 min-h-full">`.
  - Các màn hình modal / stack tự quản lý cạnh qua `<SafeAreaView edges={['top', 'bottom']}>`.
- **Bàn phím (Keyboard Avoiding)**:
  - Sử dụng `KeyboardAvoidingView` với cấu hình chuẩn đa nền tảng:
    - iOS: `behavior="padding"` kèm `keyboardVerticalOffset` (từ 0 đến 60px tuỳ theo có TopBar hay không).
    - Android: `behavior={undefined}` (để Android OS tự xử lý resize cửa sổ theo `windowSoftInputMode="adjustResize"`).
  - Áp dụng tại: `LoginScreen`, `RegisterScreen`, `AddAddressScreen`, `EditProfileScreen`, `ChatScreen`, `DishOptionSheet`.

---

## 8. Tài nguyên (Icons, Ảnh, Splash, Logo, Font)

### 8.1 Biểu tượng (Icons)
- **Thư viện**: `@expo/vector-icons` phiên bản `^15.0.2` (sử dụng bộ biểu tượng **Ionicons**).
- **Thành phần bọc chuẩn**: `mobile/src/components/ui/Icon.tsx` (41 dòng).
  - Thang kích cỡ chuẩn:
    - `xs`: **14px**
    - `sm`: **16px**
    - `md`: **20px** (mặc định)
    - `lg`: **24px**
    - `xl`: **32px**
    - Hoặc nhận số pixel tuỳ ý `number`.
  - Thang màu ngữ nghĩa (`tone`):
    - `default`: `#1A1A1A` (`ink.DEFAULT`)
    - `secondary`: `#6B6F76` (`ink.secondary`)
    - `muted`: `#9A9EA5` (`ink.muted`)
    - `inverse`: `#FFFFFF` (`ink.inverse`)
    - `brand`: `#1EB9CE` (`brand-500`)
    - `accent`: `#FF7A30` (`accent-500`)
    - `danger`: `#E5484D` (`danger.DEFAULT`)
    - `success`: `#16A34A` (`success.DEFAULT`)
    - `rating`: `#FFB400`
- **Thống kê sử dụng**:
  - 167 lần sử dụng thông qua component kit `<Icon />`.
  - 20 file vẫn import và sử dụng trực tiếp `<Ionicons color="..." size={...} />` từ `@expo/vector-icons` (chưa chuyển đổi hết sang `<Icon />`).

### 8.2 Hình ảnh và minh hoạ
- **Thư mục tài nguyên cục bộ (`mobile/assets/`)**:
  - Không có bất kỳ tệp hình ảnh cục bộ nào (`.png`, `.jpg`, `.svg`).
  - File cấu hình `mobile/app.json` không khai báo khoá `icon` và `splash`.
- **Biểu trưng và Logo (Brand Logo)**:
  - Logo ứng dụng ZomZom được vẽ hoàn toàn bằng code React Native View tại `mobile/src/screens/intro/SplashLogo.tsx` (151 dòng).
  - Sử dụng các lớp Tailwind: ô vuông bo góc `rounded-[22px]`, xoay nghiêng `-rotate-6`, nền chuyển màu `intro-teal` sang `intro-orange`, chữ "Z" lớn màu trắng và chấm tròn cam.
- **Hiển thị hình ảnh từ xa (`AppImage`)**:
  - Định nghĩa tại `mobile/src/components/ui/AppImage.tsx` (68 dòng).
  - Tải ảnh qua URI từ xa, tích hợp sẵn icon dự phòng (fallback placeholder) khi ảnh bị lỗi mạng hoặc URI rỗng.
  - Sử dụng thư viện gốc `Image` của React Native (chưa dùng thư viện chuyên dụng như `expo-image` để tối ưu bộ nhớ đệm cache).

### 8.3 Phông chữ (Typography assets)
- **Thư mục phông chữ (`mobile/assets/fonts/`)**:
  - `BeVietnamPro-Regular.ttf` (133 KB) — Cân nặng 400 (`font-body`).
  - `BeVietnamPro-Medium.ttf` (136 KB) — Cân nặng 500 (`font-body-medium`).
  - `BeVietnamPro-SemiBold.ttf` (137 KB) — Cân nặng 600 (`font-body-semibold`).
  - `BeVietnamPro-Bold.ttf` (140 KB) — Cân nặng 700 (`font-body-bold`).
  - `Baloo2-ExtraBold.ttf` (418 KB) — Chữ thương hiệu nhận diện (`font-display`).
- **Cách thức nạp font**: Nạp thông qua hook `useFonts(fontAssets)` tại `mobile/App.tsx` (dòng 58–60) từ thư viện `expo-font`. Ứng dụng chỉ render giao diện sau khi phông chữ đã sẵn sàng.

---

## 9. Chuyển động (Animations)

- **Thư viện hoạt hình**: Sử dụng duy nhất `react-native-reanimated` phiên bản `4.7.1` (kèm `react-native-worklets` `0.13.0`). Không dùng thư viện `Animated` cũ của React Native.
- **Các vị trí sử dụng hoạt hình**:
  1. `ZomZomSplashScreen.tsx`: Hoạt hình nhịp thở (pulse), hoạt hình thanh tiến trình (progress bar width), hoạt hình xe máy chạy theo vạch (`useAnimatedStyle`, `withTiming`). Thời lượng: 2.200 ms.
  2. `SplashLogo.tsx`: Hoạt hình nảy lò xo logo ZomZom (`withSpring`, `damping: 10, stiffness: 100`).
  3. `Overlays.tsx` (Toast thông báo): Hoạt hình trượt lên/xuống (`FadeInDown.springify()`, `FadeOutDown.springify()`).
  4. `Skeleton.tsx` (Bộ xương tải dữ liệu): Hoạt hình lấp lánh (shimmer/pulse opacity từ 0.3 đến 0.7 lặp vô hạn `withRepeat`).
  5. `HomeScreen.tsx`: Hoạt hình hiện thông báo đơn hàng mới (`FadeIn`, `FadeOut`).
  6. `FeaturedCarousel.tsx`: Hoạt hình trượt và khớp toạ độ scroll (`useAnimatedScrollHandler`, `useAnimatedRef`).
- **Tuân thủ cài đặt Giảm chuyển động (Reduced Motion)**:
  - Đã chủ động kiểm tra cài đặt trợ năng giảm chuyển động của hệ điều hành thông qua hook `useReducedMotion()` tại `BannerCarousel.tsx` (dòng 3) và cờ `ReduceMotion.Never` tại `Overlays.tsx` và `HomeScreen.tsx`.

---

## 10. Khả năng truy cập (Accessibility)

- **Thống kê thuộc tính trợ năng**:
  - Có **52 tệp** trong `mobile/src/` khai báo các thuộc tính `accessibilityRole`, `accessibilityLabel`, `accessibilityState`.
  - Thành phần `<Icon />` tự động ẩn đối với trình đọc màn hình (`accessibilityElementsHidden={true}`) nếu không truyền nhãn mô tả, tránh đọc lặp icon rác.
  - Thanh tab `FloatingTabBar` khai báo đầy đủ vai trò `accessibilityRole="tablist"` và `accessibilityRole="tab"`, tự động đọc số mục chưa đọc.
- **Kích thước vùng chạm (Touch Targets & HitSlop)**:
  - Token chuẩn: `size.touch = 44px` (đạt tiêu chuẩn tối thiểu 44×44 pt của Apple và 48×48 dp của Google Material).
  - Có **13 vị trí** sử dụng thuộc tính bù vùng chạm `hitSlop` (từ 6px đến 12px) cho các nút nhỏ, nút xoá tìm kiếm, nút tăng giảm số lượng và nút ẩn/hiện mật khẩu.
  - *Vấn đề tồn tại*: Một số nút dạng icon trong `DriverDeliveriesScreen` hoặc chip lọc nhỏ có kích thước 28px–32px mà chưa khai báo `hitSlop`, có thể gây khó bấm cho người dùng có ngón tay lớn.
- **Độ tương phản màu sắc (Contrast Ratio)**:
  - Màu chữ xanh ngọc `text-brand-600` (`#0E9FB3`) trên nền trắng đạt tỷ lệ tương phản **3.17:1** (chưa đạt chuẩn WCAG AA tối thiểu 4.5:1 cho văn bản thông thường, chỉ đạt chuẩn cho văn bản cỡ lớn trên 18pt).
  - Màu chữ xám phụ trợ `ink.muted` (`#9A9EA5`) trên nền trắng chỉ đạt tỷ lệ tương phản xấp xỉ **2.6:1** (khá mờ dưới trời nắng gắt).

---

## 11. Nội dung cứng và dữ liệu mẫu

- **Các chuỗi chữ viết cứng (Hardcoded Copy) trong giao diện**:
  - Slogan khởi động: `"Giao nhanh món ngon trong 30 phút"`, `"Ứng dụng đặt đồ ăn số 1 cho người sành ăn"`, `"Tối ưu lộ trình giao hàng thời gian thực"`.
  - Khối khám phá: `"Giật Deal Sốc"`, `"Gợi ý dành cho bạn"`, `"Quán gần tôi"`.
  - Lời nhắc giỏ hàng: `"Phí giao hàng sẽ được tính ở bước thanh toán"`.
  - Cảnh báo tài xế: `"Yêu cầu nộp bớt tiền mặt COD về công ty khi vượt hạn mức 2.000.000 ₫"`.
  - Phím tắt chat: `"Tôi đang đợi ở sảnh / trước nhà"`, `"Quán đang chuẩn bị món bạn nhé"`, `"Tài xế đang tới nơi nhận hàng"`, `"Đã giao đến nơi ạ, cảm ơn bạn!"`, `"Xin chờ tôi 2 phút nhé"`.
- **Dữ liệu mẫu (Seed Data) hiển thị trên app**:
  - Tên nhà hàng mẫu: `Phở Thìn 13 Lò Đúc`, `Cơm Tấm Ba Ghiền`, `Bún Bò Huế Đông Ba`, `Trà Sữa Gong Cha`.
  - Món ăn mẫu: `Phở Tái Lăn`, `Cơm Tấm Sườn Bì Chả`, `Bún Bò Đặc Biệt`, `Trà Sữa Trân Châu Đường Đen`.
  - Thông tin mẫu: Đều sử dụng các địa chỉ tại Quận 1, Quận 3, Quận Bình Thạnh và Gò Vấp, TP. Hồ Chí Minh. Toàn bộ thông tin tài khoản demo đã được che thông tin cá nhân.

---

## 12. Danh sách vấn đề và bất nhất khách quan (30 mục)

Bảng đối chiếu tổng hợp toàn bộ các điểm bất nhất, lớp sai, màu cũ, hoặc vấn đề hiển thị tìm thấy qua quét mã nguồn thực tế:

| STT | Vấn đề phát hiện | Vị trí xảy ra trong mã | Mức độ | Nhóm phân loại | Chi tiết kỹ thuật |
|:---:|---|---|:---:|:---:|---|
| **1** | Lớp `bg-surface-subtle` không tồn tại trong CSS | 13 vị trí trong `DriverAvailableOrdersScreen`, `DriverDeliveriesScreen`, `DriverDeliveryDetailScreen`, `DriverVehicleScreen` | **Cao** | Lỗi lớp CSS | Trong `tokens.json`, `surface` là chuỗi màu đơn (`#FFFFFF`), không có khoá con `subtle` -> lớp này không sinh ra mã màu, phần tử bị mất nền. |
| **2** | Bảng màu cũ `#EE4D2D` (cam đỏ Shopee) vẫn còn sót lại | `mobile/src/constants/colors.ts`, `app.json` (dòng 35), `utils/orderStatus.ts` | **Vừa** | Màu sắc | App đã đổi sang nhận diện xanh ngọc (`#1EB9CE`), nhưng thông báo notification và mã tiện ích trạng thái cũ vẫn còn cấu hình màu cam đỏ `#EE4D2D`. |
| **3** | Hai hệ thống màu song song cho trạng thái đơn | `utils/orderStatus.ts` vs `components/ui/Badge.tsx` | **Vừa** | Màu & Nhãn | `ORDER_STATUS_CONFIG` dùng màu cũ (`#10B981`, `#F59E0B`), còn `OrderStatusBadge` dùng token mới (`success-soft`, `warning-soft`). |
| **4** | Tương phản màu chữ xanh ngọc thấp trên nền trắng | 81 vị trí dùng `<Text tone="brand">` (`#0E9FB3`) | **Vừa** | Khả năng truy cập | Tỷ lệ tương phản 3.17:1, chưa đạt chuẩn WCAG AA 4.5:1 đối với văn bản cỡ chữ nhỏ dưới 18pt. |
| **5** | Tương phản màu chữ xám mờ thấp | Các chỗ dùng `ink.muted` (`#9A9EA5`) | **Vừa** | Khả năng truy cập | Tỷ lệ tương phản 2.6:1, gây khó đọc dưới ánh sáng ngoài trời. |
| **6** | Cỡ chữ tuỳ ý viết tay trong className | `SearchScreen` (7 cỡ chữ), `OwnerStatsScreen` (`text-[34px]`), `LoginScreen` (`text-[30px]`) | **Vừa** | Cỡ chữ | Không sử dụng thang cỡ chữ token mở rộng (`micro`, `caption`, `body`, `headline`, `title`, `display`). |
| **7** | Component `Card` và `StatCard` của kit không được dùng | `mobile/src/components/ui/Card.tsx`, `Admin.tsx` | **Thấp** | Thành phần rác | Được viết ra trong bộ kit dùng chung nhưng thực tế 0 màn hình nào import sử dụng (các màn tự viết `View border bg-surface p-4`). |
| **8** | Component `SheetHandle` không được dùng | `mobile/src/components/ui/Overlays.tsx` dòng 83 | **Thấp** | Thành phần rác | Tay nắm kéo của BottomSheet không được tái sử dụng, các sheet tự vẽ vạch kéo riêng. |
| **9** | 20 file vẫn import và dùng trực tiếp `Ionicons` | Các màn `Auth`, `Profile`, `Driver`, `Search` | **Vừa** | Thành phần | Chưa quy chuẩn hoá 100% qua `<Icon name="..." tone="..." />` của kit dùng chung. |
| **10** | Dùng lẫn lộn bo góc cho cùng một loại thẻ | Màn tài xế dùng `rounded-2xl` (24px), Màn chủ quán dùng `rounded-xl` (20px), Kit dùng `rounded-lg` (16px) | **Thấp** | Bo góc | Thiếu sự nhất quán về bán kính bo góc của thẻ thông tin giữa các phân hệ. |
| **11** | Chữ số tiền lớn bị bó buộc bởi kiểu chữ của kit | `OwnerStatsScreen` dòng 100 | **Vừa** | Thành phần | Do `<Text>` của kit không cho phép ghi đè `fontSize` qua `className`, màn hình phải import `RNText` gốc của React Native. |
| **12** | Không có hình ảnh tài nguyên cục bộ | `mobile/assets/` | **Vừa** | Tài nguyên | Toàn bộ ảnh phụ thuộc vào mạng internet; logo và biểu tượng phải vẽ bằng code View. |
| **13** | Thiếu cấu hình icon và splash trong `app.json` | `mobile/app.json` | **Vừa** | Cấu hình | Khi đóng gói ứng dụng native Android/iOS thật, app sẽ hiển thị icon mặc định của Expo thay vì icon ZomZom. |
| **14** | Sử dụng component ảnh gốc thay vì thư viện tối ưu | `AppImage.tsx` dùng `Image` của React Native | **Vừa** | Hiệu năng | Chưa tích hợp `expo-image` để tận dụng bộ nhớ đệm đĩa cứng, xử lý mờ (blurhash) và giải mã ảnh nền. |
| **15** | Bất nhất nhãn trạng thái `READY_FOR_PICKUP` | 5 cách gọi khác nhau giữa các màn hình | **Vừa** | Nhãn trạng thái | Khách: "Chuẩn bị" / "Hoàn thành"; Chủ quán: "Chờ tài xế"; Tài xế: "Sẵn sàng" / "Món đã sẵn sàng"; Admin: "Chờ tài xế lấy". |
| **16** | Bất nhất cách viết hoa nhãn trạng thái `CANCELLED` | `utils/orderStatus.ts` vs `OwnerOrdersScreen` | **Thấp** | Chính tả | Chỗ viết "Đã hủy" (dấu ngã trên y), chỗ viết "Đã huỷ" (dấu ngã trên u). |
| **17** | Trạng thái `PREPARING` có nhiều tên gọi | Màn khách vs Màn tài xế | **Thấp** | Nhãn trạng thái | Khách: "Đang làm món"; Chủ quán: "Đang chuẩn bị"; Tài xế: "Đang nấu"; Admin: "Đang chuẩn bị". |
| **18** | Thiếu `hitSlop` trên một số nút icon nhỏ | `DriverDeliveriesScreen` dòng 180, `OrderHistoryScreen` | **Vừa** | Truy cập | Nút thao tác nhỏ hơn 40×40px không có hitSlop, dễ bấm trượt trên thiết bị di động. |
| **19** | Lớp `shadow-none` được dùng làm giải pháp tình thế | `ChatScreen` dòng 278, `Overlays.tsx` | **Thấp** | Kỹ thuật | Phải viết lớp `shadow-none` để triệt tiêu bóng đổ tránh lỗi NativeWind remount component. |
| **20** | Thư viện `components/common/` cũ chưa được dọn dẹp | `mobile/src/components/common/` (8 file StyleSheet) | **Thấp** | Mã nguồn | Bộ thành phần cũ viết bằng StyleSheet từ phiên bản trước không còn dùng nhưng vẫn nằm trong source code. |
| **21** | Hai file bản đồ nền tảng riêng biệt | `AppMapView.native.tsx` và `AppMapView.web.tsx` | **Thấp** | Kỹ thuật | Bản native dùng `react-native-maps`, bản web dùng placeholder HTML. |
| **22** | Chữ thương hiệu Baloo 2 chỉ có một độ đậm ExtraBold | `mobile/assets/fonts/Baloo2-ExtraBold.ttf` | **Thấp** | Typography | Không có các biến thể Regular/Medium/Bold của Baloo 2, chỉ dùng được duy nhất cho logo và tiêu đề cực lớn. |
| **23** | `tokens.json` định nghĩa token không ai dùng | `size.search = 40`, `size.chip = 28`, `colors.rating` | **Thấp** | Tokens | Các token này có trong file JSON nhưng không có lớp nào trong code sử dụng. |
| **24** | Thiếu cờ `titleAlign="large"` đồng bộ | `TopBar.tsx` | **Thấp** | Giao diện | `TopBar` có hỗ trợ `titleAlign="large"` nhưng hầu hết các màn hình dùng `titleAlign="center"` mặc định. |
| **25** | Thiếu thông tin phiên bản động | `ProfileScreen`, `AdminProfileScreen` | **Thấp** | Dữ liệu tĩnh | Chuỗi "Phiên bản 1.0.0" được viết cứng (hardcoded) trong text thay vì lấy từ `Constants.expoConfig.version`. |
| **26** | Thanh giỏ hàng nổi che nội dung nếu thiếu clearance | `RestaurantDetailScreen` | **Vừa** | Bố cục | Nếu danh sách món không có padding đáy đủ lớn, món ăn cuối cùng trong thực đơn sẽ bị thanh giỏ hàng che mất. |
| **27** | Cảnh báo bán kính quán ăn chỉ hiển thị dạng text nhỏ | `RestaurantDetailScreen` dòng 158 | **Vừa** | Trải nghiệm | Khi khách ở ngoài bán kính giao của quán, cảnh báo chỉ là dòng text nhỏ màu vàng, không có khung viền cảnh báo nổi bật. |
| **28** | Dải gradient đầu trang quá dài trên màn hình ngắn | `HomeScreen.tsx` | **Thấp** | Giao diện | Gradient `preset="header"` kéo dài chiếm tới 78% chiều cao đầu trang, trên màn hình nhỏ có thể lấn át nội dung danh mục. |
| **29** | Khối tài khoản thử nghiệm nhanh hiển thị trực tiếp | `LoginScreen.tsx` | **Vừa** | Bảo mật | Khối tài khoản demo nằm ngay trên màn hình đăng nhập chính thức, cần ẩn đi khi phát hành ứng dụng ra thị trường. |
| **30** | Đơn vị tiền tệ hiển thị xen kẽ `₫` và `đ` | `format.ts` vs các text viết tay | **Thấp** | Nhất quán | Hàm `formatVND` xuất ra ký hiệu `₫`, trong khi một số màn hình viết tay chữ `đ` hoặc `VNĐ`. |

