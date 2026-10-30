# Đặc tả thiết kế – Đợt thiết kế lại giao diện mobile

> Trạng thái: **bản nháp chờ duyệt** (Giai đoạn 1). Chưa sửa dòng mã giao diện nào.
> Nhánh: `redesign/nativewind-ui` (tách từ `fix-bundle-and-sdk58` @ `fdfbe05`).
> Ngày: 30/10/2026.

**Cách có số liệu:** ảnh mẫu là 1284×2778 px của iPhone @3x, tức màn hình **428×926 điểm**. Mọi kích thước dưới đây được đo bằng mắt trên ảnh (ước lượng từ toạ độ pixel ÷ 3), sai số khoảng ±2 điểm với kích thước và ±1 điểm với cỡ chữ. Màu được ước lượng bằng mắt từ ảnh nén, **không lấy mẫu pixel**, nên có thể lệch vài đơn vị hex. Không có mục nào được coi là chính xác tuyệt đối.

---

## 0. Kết quả Giai đoạn 0

| Hạng mục | Lệnh | Kết quả thật |
|---|---|---|
| Kiểm tra kiểu | `npm run typecheck` | 0 lỗi |
| Lint | `npm run lint` | 0 lỗi, 4 cảnh báo `react-hooks/exhaustive-deps` (OrderTracking, AddAddress ×2, AddressPicker) |
| Test | `npx jest` | 4 bộ, 17/17 đạt |
| Đóng gói web | `npx expo export -p web` | Thành công, 1 bundle 2 MB |
| Đóng gói Android | `npx expo export -p android` | Thành công, 1 bundle Hermes 3,8 MB |
| Đóng gói iOS | chưa chạy | Máy Windows; `expo export -p ios` vẫn chạy được nhưng chưa thử. Sẽ chạy ở Giai đoạn 2 |

**Phiên bản:** Expo SDK 58.0.21 · React Native 0.88.1 · React 19.3.0 · react-native-web 0.21.4 · TypeScript 5.7.3 · **Reanimated: chưa cài**.

`npx expo install --check` báo 3 gói lệch bản Expo khuyến nghị: `@types/react` 19.0.14 (khuyến nghị ~19.3.0), `jest` 29.7.0 (~30.5.2), `typescript` 5.7.3 (~6.0.3). Hiện chưa gây lỗi; **không nâng cấp** khi chưa được đồng ý.

### Tương thích NativeWind (bằng chứng sơ bộ, sẽ xác nhận lại ở Giai đoạn 2)

Lấy trực tiếp từ npm registry ngày 30/10/2026:

| Gói | Bản | Phụ thuộc ngang hàng |
|---|---|---|
| `nativewind` (`latest`) | **4.2.7** (phát hành 14/09/2026, bản chính thức) | `tailwindcss >3.3.0`; kéo `react-native-css-interop 0.2.7` |
| `react-native-css-interop` | 0.2.7 | `react >=18`, `react-native *`, `tailwindcss ~3`, `react-native-reanimated >=3.6.2` |
| `nativewind` (`rc`) | 5.0.0-rc.0 (13/09/2026, **bản ứng viên**) | `tailwindcss >4.1.11`, `react-native-css 3.1.0-rc.0` (cần `lightningcss`, `@expo/metro-config >=54`) |
| Expo 58 ghim sẵn | `react-native-reanimated 4.7.1`, `react-native-worklets 0.13.0` | Reanimated 4.7.1 yêu cầu RN `0.86 - 0.88` → khớp RN 0.88.1 |

Kết luận sơ bộ: **không có lý do DỪNG**. Ứng viên đề xuất là NativeWind 4.2.7 + Tailwind 3.4 + Reanimated 4.7.1 (theo bản Expo ghim). Tuy nhiên chưa tìm thấy tuyên bố chính thức từ NativeWind rằng 4.2.7 đã được thử trên SDK 58/RN 0.88; chỉ có khớp về phụ thuộc ngang hàng. Việc này phải được chứng minh bằng màn thử ở Giai đoạn 2. Với v5 RC, có báo cáo cộng đồng rằng chạy được trên SDK 58 nhưng cần cấu hình thêm và trình biên dịch RC từ chối `lightningcss 1.33.0`, nên không khuyến nghị.

Lưu ý: Reanimated là mã native. Dự án đang dùng `expo-dev-client`, nên sau khi cài **phải build lại bản dev client** trên điện thoại.

### Phát hiện bảo mật (ngoài phạm vi, cần bạn biết)
File `BAO_CAO_BO_SUNG_GIAI_DOAN_0.md` (đã commit ở `2610391`) ghi nguyên văn khoá Goong Maps (`gjZH…prlT`). Khoá đã nằm trong lịch sử Git. Khuyến nghị: đổi khoá trên Goong Console và che khoá trong file. Mình chưa sửa gì.

---

## 1. Mô tả từng ảnh mẫu

Ngôn ngữ chung: nền trắng, màu nhấn **xanh ngọc (teal/cyan)**, cam cho khuyến mãi, ảnh là trọng tâm, bo góc lớn, bóng đổ rất nhẹ, biểu tượng nét mảnh (outline), không nhãn chữ dưới tab.

### Ảnh 1 – Trang chủ, phần đầu
1. **Header gradient** xanh ngọc đậm (≈ `#0E4A55`) nhạt dần sang trắng ở khoảng 400 điểm đầu. Nút quay lại tròn 48 điểm nền trắng mờ; **dòng địa chỉ** chữ trắng 18 điểm semibold, cắt bằng dấu ba chấm, mũi tên xuống.
2. **Thanh tìm kiếm lớn**: cao ≈ 56, nền trắng, bo ≈ 20, viền 1 điểm xám rất nhạt + bóng nhẹ, icon kính lúp 24 nét mảnh, placeholder 18 điểm xám.
3. **Hàng danh mục cuộn ngang**: thẻ ≈ 83×134, bo ≈ 12, nền xám rất nhạt chuyển trắng, tên danh mục 2 dòng góc trên trái (16 điểm regular), ảnh minh hoạ 3D ở dưới phải. Thẻ cuối bị cắt mép để gợi ý cuộn.
4. **Hàng ô khuyến mãi** ≈ 92×111, bo ≈ 12, ảnh đồ hoạ toàn khối (banner do đối tác thiết kế).
5. **Hàng thương hiệu**: thẻ ≈ 92×111, nền gradient màu thương hiệu, logo tròn trắng lớn ở giữa, nhãn ưu đãi trong ô trắng bo tròn chữ đỏ đậm 13 điểm.
6. **Carousel banner** rộng (≈ 3:1 so với chiều rộng thẻ), bo 16, chấm chỉ trang dạng gạch ngắn.
7. **Thanh tab nổi** + **nút giỏ hàng nổi** (mô tả ở ảnh 7).

### Ảnh 3 – Trang chủ khi cuộn
1. **Header thu gọn**: nền trắng, nút quay lại tròn 40, thanh tìm kiếm cao ≈ 40, nền xám nhạt `#F2F3F5`, bo ≈ 12, không viền.
2. Banner lớn bo 16.
3. **Khối "Bữa Ăn 29K / Freeship 12K"**: tiêu đề 20 điểm semibold, phụ đề 16 regular; nút tròn mũi tên phải 40 điểm nền trắng có bóng. Nền khối là gradient cyan nhạt mờ.
4. **Thẻ món**: ảnh vuông ≈ 162, bo 14; huy hiệu cam "Giảm 30%" góc trên trái (bo trên trái theo ảnh, bo dưới phải); nút "+" tròn trắng 40 góc dưới phải. Dưới ảnh: icon cửa hàng + tên quán 14 xám (1 dòng), tên món 18 regular đen (2 dòng), giá 20 semibold màu teal + giá gốc gạch ngang xám 14.
5. **Khối "Gợi ý dành cho Khoa"**: tiêu đề có emoji, lưới thẻ quán 3 cột cuộn ngang, ảnh vuông ≈ 120 bo 16, huy hiệu sao + điểm ở góc dưới trái ảnh trên nền tối mờ; dấu tích xanh "đối tác", tên quán 2 dòng 16 điểm, khoảng cách 14 xám với icon tuyến đường.

### Ảnh 4 – Tiếp tục cuộn
- Khối "Gợi ý" dạng 2 hàng × n cột cuộn ngang.
- **Khối deal** nền kem/hồng nhạt bo 24, tiêu đề có emoji lửa, các thẻ banner dọc bo 16 kèm chú thích ở dưới; thẻ giữa to hơn (carousel phóng to).

### Ảnh 5 – Các khối quán theo chủ đề
- Tiêu đề + phụ đề + nút mũi tên tròn.
- **Thẻ quán dọc**: ảnh vuông ≈ 162 bo 14, huy hiệu voucher góc dưới trái ảnh (nền teal, chữ trắng 13). Dưới: tích xanh + tên quán 2 dòng 16; hàng meta: sao vàng + "4.9 (216)" + icon túi + "4.2K+"; hàng chip: chip cam nhạt "105k" (icon vé) và chip xanh nhạt "Freeship" (icon hộp).
- Nền mỗi khối là gradient màu khác nhau (cyan, vàng cam) → tạo nhịp, tránh lặp.

### Ảnh 6 – "Quán gần tôi"
- Nền khối xám `#F2F3F5`; tiêu đề có icon ghim đỏ 22 điểm semibold, phụ đề 14.
- **Thẻ quán ngang**: thẻ trắng bo 16, padding 12; ảnh vuông 112 bo 12; bên phải: tên 2 dòng 17 điểm; meta "★ 4.7 (39) · 700+ · 10 phút"; chip voucher cam + chip freeship xanh kèm số tiền.
- Liên kết "Xem thêm 49 quán >" căn giữa, chữ xám 15.

### Ảnh 7 – Bản đồ quán gần
- Bản đồ chiếm ~55% trên, nút X tròn trắng góc trên trái, chip lọc trắng bo tròn có bóng ("Khuyến mại", "Chỉ Green Partner"), nút định vị vuông bo 12.
- **Bảng trượt từ dưới** có tay kéo 40×4, hàng danh mục dạng icon 3D + nhãn 14, dòng "Quán gần <địa chỉ>" với địa chỉ màu teal và mũi tên xuống, rồi danh sách thẻ ngang như ảnh 6 nhưng không có khung thẻ.
- **Thanh tab**: viên thuốc trắng nổi rộng ≈ 268, cao ≈ 58, bo tròn hoàn toàn, bóng lớn mềm; 3 icon (nhà, bản đồ, tim) 24 điểm nét mảnh xám; mục đang chọn là viên cyan gradient có hào quang, icon trắng tô đặc. **Nút giỏ hàng** tròn 64 cyan gradient tách riêng bên phải.

### Ảnh 2 – Danh sách địa chỉ (dạng modal)
- Thanh trên: X bên trái, tiêu đề "Địa chỉ" 18 semibold giữa.
- Ô tìm kiếm nền `#F2F3F5` bo 12 cao ≈ 44, icon chấm tròn đen; bên phải là cờ VN + "Hồ Chí..." (bộ chọn tỉnh).
- **Dòng địa chỉ**: icon lịch sử 24 + khoảng cách "80 m" dưới icon (13 xám); tiêu đề 17 regular đen tối đa 2 dòng; địa chỉ 15 xám tối đa 2 dòng; tim outline + nút ba chấm dọc bên phải. Không đường kẻ giữa các dòng, khoảng cách dọc ≈ 16.
- Đường kẻ phân cách toàn chiều rộng, rồi **dòng hành động**: icon trong vòng tròn xám 44, tiêu đề 17, phụ đề 15 xám, mũi tên phải. Công tắc màu cyan.
- Khối "Không thấy địa điểm bạn cần?" tiêu đề 17 semibold + dòng hành động có dấu cộng.

### Ảnh 8 – Yêu thích (rỗng)
- Tiêu đề trang lớn 24 bold căn trái.
- Thẻ minh hoạ gradient (vàng nhạt → trắng → cyan nhạt) bo 20, ảnh minh hoạ ở giữa, câu hướng dẫn 16 căn giữa.
- "Yêu thích" 17 semibold + "0 quán" 16 xám.
- Nút viền "+ Thêm bộ sưu tập mới": cao 48, nền cyan rất nhạt, viền cyan nhạt, chữ teal đậm 17 semibold, bo 12.

### Ảnh 9 – Giỏ hàng (rỗng)
- X ở trên trái, tiêu đề trang lớn 26 bold; nút chữ "Quản lý" xám (vô hiệu) bên phải.
- Ảnh rổ 3D giữa màn, tiêu đề 18 semibold, phụ đề 16 xám.

### Trạng thái tương tác nhìn thấy được
Mục tab đang chọn (viên cyan + hào quang); công tắc bật (cyan); nút "Quản lý" vô hiệu (xám nhạt); chấm chỉ trang carousel (chấm đang xem dài hơn và trắng đậm). Không thấy trạng thái nhấn trong ảnh tĩnh → sẽ dùng giảm độ mờ/thu nhỏ nhẹ.

---

## 2. Design tokens đề xuất

### 2.1 Màu (ước lượng bằng mắt từ ảnh)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `brand-50` | `#E9FAFC` | Nền chip Freeship, nền nút viền |
| `brand-100` | `#CDF3F8` | Viền nút phụ, nền chọn |
| `brand-300` | `#7FE0EC` | Gradient tab đang chọn (đầu sáng) |
| `brand-500` | `#1EB9CE` | Giá tiền, liên kết, công tắc, nút chính |
| `brand-600` | `#0E9FB3` | Trạng thái nhấn, chữ teal trên nền sáng (tương phản tốt hơn) |
| `brand-900` | `#0E4A55` | Header gradient trang chủ |
| `accent-500` | `#FF7A30` | Huy hiệu giảm giá |
| `accent-50` | `#FFF2E8` | Nền chip voucher |
| `accent-700` | `#D9541A` | Chữ chip voucher |
| `bg` | `#FFFFFF` | Nền màn |
| `bg-subtle` | `#F2F3F5` | Nền khối "Quán gần", ô tìm kiếm phụ |
| `surface` | `#FFFFFF` | Thẻ |
| `text` | `#1A1A1A` | Chữ chính |
| `text-secondary` | `#6B6F76` | Chữ phụ |
| `text-muted` | `#9A9EA5` | Placeholder, chữ vô hiệu |
| `border` | `#E6E8EB` | Viền |
| `divider` | `#EFF0F2` | Kẻ phân cách |
| `success` | `#16A34A` | Thành công |
| `warning` | `#F59E0B` | Cảnh báo |
| `danger` | `#E5484D` | Lỗi, tim đã thích |
| `rating` | `#FFB400` | Sao |
| `verified` | `#1EB9CE` | Dấu tích đối tác (cùng brand) |

**Màu trạng thái đơn** (một bảng duy nhất, nhãn giữ nguyên như `utils/orderStatus.ts` hiện tại):

| Trạng thái | Nhãn hiện có | Chữ | Nền |
|---|---|---|---|
| PENDING | Chờ xác nhận | `#B45309` | `#FEF3C7` |
| CONFIRMED | Đã nhận đơn | `#1D4ED8` | `#DBEAFE` |
| PREPARING | Đang chuẩn bị món | `#6D28D9` | `#EDE9FE` |
| READY_FOR_PICKUP | Chờ tài xế lấy | `#0E7490` | `#CFFAFE` |
| PICKED_UP | Đang giao hàng | `#0E9FB3` | `#E9FAFC` |
| DELIVERED | Giao thành công | `#15803D` | `#DCFCE7` |
| CANCELLED | (giữ nhãn hiện có) | `#B91C1C` | `#FEE2E2` |

### 2.2 Chữ
Font đề xuất: **Be Vietnam Pro** (giấy phép SIL OFL 1.1, thiết kế riêng cho tiếng Việt), lưu file `.ttf` trong `mobile/assets/fonts`, nạp bằng `expo-font` (đã có). Ảnh mẫu trông như font hệ thống iOS (SF Pro), nhưng SF Pro không được phép đóng gói cho Android/web, nên chọn font gần nhất có giấy phép mở. Sẽ kiểm tra bằng chuỗi: *"Đường Dương Quảng Hàm – Phở bò tái nạm, cà phê muối, bánh xèo giòn rụm, ỷ ỵ ữ ự ẫ ẩ."*

| Token | Cỡ/dòng (điểm) | Độ đậm | Ví dụ trong mẫu |
|---|---|---|---|
| `display` | 26/32 | 700 | "Quản lý", "Góc khoái khẩu" |
| `title` | 20/28 | 600 | "Bữa Ăn 29K", "Quán gần tôi" |
| `headline` | 18/24 | 600 | Dòng địa chỉ, tiêu đề thanh trên |
| `body-lg` | 16/22 | 400–500 | Tên quán, tên món |
| `body` | 14/20 | 400 | Địa chỉ phụ, meta |
| `caption` | 13/18 | 500 | Chip, huy hiệu |
| `micro` | 11/14 | 600 | Số trên huy hiệu |
| `price` | 18/24 | 600 | Giá teal |

Độ đậm dùng: 400, 500, 600, 700 (4 file font).

### 2.3 Khoảng cách (bội số của 4)
`1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40` (giữ thang mặc định Tailwind). Lề màn hình **16**; khoảng giữa các khối lớn **24–32**; khoảng giữa thẻ trong hàng ngang **12**; padding thẻ **12**.

### 2.4 Bo góc
`sm 8` (chip nhỏ) · `md 12` (ô tìm kiếm phụ, thumbnail, nút) · `lg 16` (thẻ, banner, ảnh quán) · `xl 20` (thanh tìm kiếm lớn, thẻ minh hoạ) · `2xl 24` (khối deal, bảng trượt) · `full` (tab bar, nút tròn, chip tròn).

### 2.5 Bóng đổ
| Token | Giá trị (iOS) | Android elevation | Dùng cho |
|---|---|---|---|
| `shadow-card` | 0 1 4, đen 6% | 1 | Thẻ trắng |
| `shadow-raised` | 0 4 12, đen 10% | 4 | Nút tròn mũi tên, chip lọc trên bản đồ |
| `shadow-float` | 0 10 30, đen 12% | 10 | Thanh tab nổi, bảng trượt |
| `shadow-glow` | 0 6 16, brand 35% | 6 | Mục tab đang chọn, nút giỏ hàng |

### 2.6 Tỉ lệ ảnh
Thẻ món và thẻ quán: **1:1**; thumbnail dòng: **1:1** (112 hoặc 64); banner: **≈ 3:1**; ô khuyến mãi: **≈ 5:6**; thẻ danh mục: **≈ 5:8**.

### 2.7 Biểu tượng
Đề xuất giữ **Ionicons** (gói `@expo/vector-icons` đã có, giấy phép MIT), chỉ dùng biến thể `-outline`, biến thể đặc chỉ cho trạng thái đang chọn. Kích thước: 24 (điều hướng, thanh trên), 20 (trong nút, dòng), 16 (meta), 14 (trong chip). Ảnh mẫu có nét giống Lucide; nếu bạn muốn sát hơn có thể đổi sang `lucide-react-native` (ISC) nhưng phải thêm `react-native-svg` → không khuyến nghị đợt này.

### 2.8 Chiều cao thành phần
Thanh tìm kiếm lớn **52** (mẫu ≈ 56, giảm nhẹ để màn 360 điểm đỡ chật) · thanh tìm kiếm thường **40** · nút lớn **48**, vừa **40**, nhỏ **32** · thanh trên **56** · thanh tab nổi **64** + vùng an toàn · nút giỏ nổi **60** · chip **28** · dòng danh sách **≥ 64** · vùng chạm tối thiểu **44**.

---

## 3. Thành phần lặp lại trong mẫu
1. Thanh trên (nút quay lại/đóng tròn, tiêu đề giữa hoặc lớn bên trái, hành động phải)
2. Dòng "Giao đến" có địa chỉ cắt ba chấm + mũi tên
3. Thanh tìm kiếm (2 cỡ: lớn trên header, gọn khi cuộn)
4. Thẻ danh mục (chữ + ảnh), mục danh mục dạng icon + nhãn
5. Banner/carousel có chấm chỉ trang
6. Tiêu đề khối + phụ đề + nút mũi tên tròn ("Xem tất cả")
7. Thẻ món dọc (ảnh, huy hiệu giảm giá, nút "+", tên quán, tên món, giá, giá gốc)
8. Thẻ quán dọc (ảnh, huy hiệu sao, dấu tích, tên, khoảng cách, chip)
9. Thẻ quán ngang (thumbnail + thông tin + chip)
10. Chip thông tin (voucher cam, freeship xanh), chip lọc (trắng có bóng)
11. Huy hiệu (giảm giá, đánh giá trên ảnh, số lượng)
12. Dòng danh sách (icon trái, tiêu đề, phụ đề, hành động phải) và dòng hành động (icon trong vòng tròn + mũi tên)
13. Công tắc
14. Bảng trượt từ dưới có tay kéo
15. Thanh tab nổi + nút giỏ hàng nổi
16. Trạng thái rỗng có minh hoạ + nút hành động
17. Nút viền nền nhạt
18. Bản đồ kèm nút nổi

---

## 4. So sánh mẫu và hiện trạng

Ghi chú chung: 43 file đang dùng `StyleSheet.create`; màu chủ đạo hiện là cam `#EE4D2D` (lặp lại 136 lần viết tay); font hệ thống; icon Ionicons trộn đặc/viền.

| Màn | Hiện trạng | Mẫu | Khác biệt chính |
|---|---|---|---|
| Trang chủ | Thanh trên trắng có địa chỉ + icon giỏ; 1 banner Unsplash cứng; 5 danh mục tròn cứng; dòng "Bạn có 4 mã giảm giá" (**số giả**); 4 bộ sưu tập cứng; "Gợi ý" với "15-20 phút" và "Freeship" (**cứng**); sau đó lặp 1 kiểu thẻ quán lớn | Ảnh 1, 3–6 | Thiếu header gradient, thiếu nhịp nhiều kiểu khối, thẻ lặp một kiểu, chứa dữ liệu giả, dùng vòng xoay toàn màn |
| Thẻ quán | Ảnh ngang + tên + sao + thời gian + khoảng cách + Mở/Đóng | Ảnh 5, 6 | Mẫu có 2 biến thể (dọc vuông, ngang thumbnail); số đánh giá, số đơn, voucher **không có trong API** |
| Thanh tab | 5 tab có nhãn, nền trắng phẳng, huy hiệu **"99+" cứng** ở Yêu thích | Ảnh 1, 7–9 | Mẫu: viên nổi, 3 icon không nhãn + nút giỏ tách riêng |
| Danh sách địa chỉ | Trang có tiêu đề, ô tìm kiếm, "Thêm nhanh", thẻ địa chỉ có nhãn Mặc định/Đang chọn | Ảnh 2 | Mẫu dạng modal, dòng phẳng không khung, dòng hành động có icon tròn |
| Chọn vị trí bản đồ | Có màn AddressPicker | Ảnh 7 (bố cục bản đồ + bảng trượt) | Dùng chung ngôn ngữ: nút nổi tròn, bảng trượt bo 24 |
| Yêu thích | **Toàn bộ dữ liệu giả** (3 quán, món Unsplash cứng); không có API yêu thích | Ảnh 8 | Phải bỏ dữ liệu giả → hiện trạng thái rỗng như mẫu |
| Giỏ hàng | Trạng thái rỗng icon giỏ 64 + nút "Khám phá ngay" | Ảnh 9 | Mẫu: tiêu đề lớn, minh hoạ lớn, nút X |
| Các màn còn lại (Đăng nhập, Đăng ký, Tìm kiếm, Chi tiết quán, Thanh toán, Đơn hàng, Theo dõi, Hộp thư, Tài khoản, Voucher, Chat, Đánh giá, Owner/Driver/Admin) | Có, phong cách cam | **Không có ảnh mẫu** | Sẽ suy ra từ cùng ngôn ngữ thiết kế; bảng đối chiếu sẽ ghi "không có mẫu" |

### Khối trong mẫu không có dữ liệu thật để hiển thị

| Khối trong mẫu | Dữ liệu cần | Hiện có? |
|---|---|---|
| Banner, ô khuyến mãi, ô thương hiệu | Bảng `Banner` có trong DB nhưng **không có API** | Không |
| Danh mục toàn hệ thống (Bún – Phở, Trà sữa…) | `Category` hiện chỉ là danh mục thực đơn của từng quán | Không |
| Số đánh giá "(216)", số đơn "4.2K+" | Bảng `Review` có, không có API/trường đếm | Không |
| Chip voucher "105k" | Bảng `Voucher` có, không có API công khai | Không |
| Giá giảm/giá gốc | `MenuItem.discountPrice` có trong DB, **không có trong kiểu mobile** | Một phần |
| Thời gian giao, freeship | Tính từ `distanceKm` qua `utils/fee.ts` | Có (tính từ dữ liệu) |
| Đánh giá sao, khoảng cách, mở/đóng | `Restaurant.rating`, `distanceKm`, `isOpen` | Có |
| Danh sách yêu thích | Không có API | Không |
| Lịch sử địa chỉ + khoảng cách "80 m" | Địa chỉ đã lưu + toạ độ; khoảng cách tính được từ GPS | Có (tính được) |

Đề xuất mặc định: các khối không có dữ liệu sẽ **ẩn** (không giữ chỗ trống, không số giả). Danh mục trên trang chủ chỉ giữ nếu bạn đồng ý coi chúng là **lối tắt tìm kiếm** (chạm vào là tìm theo từ khoá), không phải dữ liệu.

---

## 5. Mâu thuẫn giữa các ảnh mẫu (và với app) và cách xử lý

1. **Màu thương hiệu:** mẫu là xanh ngọc; app và icon thông báo (`app.json`) đang dùng cam `#EE4D2D`. → Câu hỏi 1.
2. **Thanh tab:** mẫu có 3 tab (Trang chủ, Bản đồ, Yêu thích) + nút giỏ; app có 5 tab (Trang chủ, Đơn hàng, Yêu thích, Hộp thư, Tài khoản) và **không có màn Bản đồ**. Không được đổi cấu trúc điều hướng. → Câu hỏi 2.
3. **Ảnh 1 có nút quay lại trên trang chủ**: trong app, Trang chủ là tab gốc, không có màn trước. → Bỏ nút quay lại.
4. **Ảnh 9 ghi "Quản lý" hai lần** (tiêu đề và nút): có vẻ là lỗi trong mẫu. → Tiêu đề "Giỏ hàng", nút "Quản lý" chỉ hiện khi giỏ có món.
5. **Header gradient đậm (ảnh 1) và header trắng (ảnh 3–6)** là cùng một màn ở hai vị trí cuộn. → Gradient tĩnh ở đầu trang, thanh tìm kiếm gọn dính trên khi cuộn qua (chuyển đổi đơn giản, không hoạt hình phức tạp ở Giai đoạn 4).
6. **Trang trí theo mùa (Halloween, dơi) và ảnh 3D/minh hoạ** không có tài sản kèm giấy phép trong dự án. → Không sao chép. Trạng thái rỗng dùng icon lớn trong vòng tròn màu nhạt; nếu bạn cung cấp minh hoạ có giấy phép thì sẽ thay vào.
7. **Thanh tìm kiếm placeholder là tên một quảng cáo** ("Cà Phê Muối Chú Long – Chỉ Từ 19K/Ly"). → Dùng placeholder chung: "Tìm món ăn, quán ăn".
8. **Ảnh 2 có bộ chọn tỉnh và công tắc "sáp nhập tỉnh"**: app không có tính năng này. → Không làm.

---

## 6. Câu hỏi cần bạn trả lời (kèm khuyến nghị)

**Câu 1 – Màu thương hiệu.** Đổi sang xanh ngọc như mẫu (`brand-500 #1EB9CE`, chữ teal đậm `#0E9FB3` để đủ tương phản) hay giữ cam `#EE4D2D` và chỉ lấy bố cục của mẫu?
→ *Khuyến nghị:* đổi sang xanh ngọc, cam chỉ dùng cho khuyến mãi (đúng như mẫu). Màu thông báo trong `app.json` cũng đổi theo.

**Câu 2 – Thanh tab.** Giữ 5 tab hiện có nhưng vẽ lại theo kiểu mẫu thế nào?
→ *Khuyến nghị:* thanh viên nổi, 5 icon **có nhãn ngắn** bên dưới (yêu cầu "không bị cắt chữ" và dễ hiểu hơn khi có 5 tab), mục đang chọn là viên cyan. **Không** thêm nút giỏ nổi riêng vì giỏ đã có ở thanh trên trang chủ và thanh "Xem giỏ hàng" khi có món; thêm nút giỏ nổi sẽ che nội dung trên màn 360 điểm. Bỏ huy hiệu "99+" giả.

**Câu 3 – Thay đổi chưa commit.** Nhánh mới đang mang theo 9 file đã sửa và ~40 file mới chưa commit (AppImage, useDeliveryAddressStore, ảnh món ăn, `seed.ts`…). Đợt thiết kế lại sẽ sửa chính các file như `RestaurantCard.tsx`, `MenuItemRow.tsx`.
→ *Khuyến nghị:* cho phép mình commit nguyên trạng chúng thành **một commit nền** trên nhánh `redesign/nativewind-ui` trước khi làm Giai đoạn 2, để mọi bước sau có điểm quay lại rõ ràng.

Ngoài ra, nếu bạn không phản đối thì mình áp dụng mặc định ở mục 4: **ẩn** mọi khối không có dữ liệu (banner, voucher, số đánh giá, yêu thích) thay vì thêm API trong đợt này.
