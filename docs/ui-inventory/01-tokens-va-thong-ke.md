# Phụ lục 01 — Design tokens và thống kê giá trị thực tế (mục 2–3)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md)

Danh sách đầy đủ từng giá trị kèm số lần nằm ở [07-phu-luc-tho.md](07-phu-luc-tho.md). File này giải thích nguồn gốc, đối chiếu token với cách dùng thực tế và nêu các điểm lệch.

## Mục lục

- [2. Design tokens](#2-design-tokens)
  - [2.1 Nơi định nghĩa](#21-nơi-định-nghĩa)
  - [2.2 Màu](#22-màu)
  - [2.3 Chữ](#23-chữ)
  - [2.4 Bo góc, bóng, kích thước](#24-bo-góc-bóng-kích-thước)
  - [2.5 Gradient](#25-gradient)
  - [2.6 Bảng màu cũ còn sót](#26-bảng-màu-cũ-còn-sót)
  - [2.7 Token có tên nhưng không dùng / dùng rất ít](#27-token-có-tên-nhưng-không-dùng--dùng-rất-ít)
  - [2.8 Giá trị dùng mà không có token](#28-giá-trị-dùng-mà-không-có-token)
- [3. Thống kê giá trị thực tế](#3-thống-kê-giá-trị-thực-tế)
  - [3.1 Màu](#31-màu)
  - [3.2 Chữ màu xanh ngọc dùng làm màu chữ](#32-chữ-màu-xanh-ngọc-dùng-làm-màu-chữ)
  - [3.3 Cỡ chữ, độ đậm, họ chữ](#33-cỡ-chữ-độ-đậm-họ-chữ)
  - [3.4 Khoảng cách](#34-khoảng-cách)
  - [3.5 Bo góc và bóng](#35-bo-góc-và-bóng)
  - [3.6 File dùng StyleSheet / style inline](#36-file-dùng-stylesheet--style-inline)
  - [3.7 File dùng giá trị tuỳ ý](#37-file-dùng-giá-trị-tuỳ-ý)
  - [3.8 Lớp không sinh ra style](#38-lớp-không-sinh-ra-style)

---

## 2. Design tokens

### 2.1 Nơi định nghĩa

| Nơi | Vai trò |
|---|---|
| `mobile/src/theme/tokens.json` | Nguồn duy nhất của token: `colors`, `fontFamily`, `fontSize`, `radius`, `shadow`, `size`. |
| `mobile/tailwind.config.js` | Nạp `tokens.json` vào `theme.extend` (colors, fontFamily, fontSize, borderRadius, boxShadow, height/minHeight/width/minWidth từ `size`). Không ghi đè thang mặc định của Tailwind, nên các lớp mặc định (`p-4`, `gap-2`, `rounded-full`, `text-white`…) vẫn dùng được. |
| `mobile/src/theme/index.ts` | Xuất `palette` (màu từ tokens cho chỗ cần giá trị JS, ví dụ `color=` của Ionicons) và `fontAssets` (nạp font). |
| `mobile/src/theme/interop.ts` | `cssInterop` cho `SafeAreaProvider`, `SafeAreaView`, `Animated.View` để nhận `className`. |
| `mobile/src/components/ui/Gradient.tsx` | Các preset gradient (chuỗi CSS dùng `backgroundImage` của RN 0.88), xây từ `palette`. |
| `mobile/src/constants/colors.ts` | **Bảng màu cũ** (cam đỏ #EE4D2D), không đi qua tokens. Vẫn được `mobile/src/utils/orderStatus.ts` dùng. |

### 2.2 Màu

Giá trị trong `mobile/src/theme/tokens.json`:

| Nhóm | Khoá → giá trị |
|---|---|
| brand | 50 `#E9FAFC` · 100 `#CDF3F8` · 200 `#A6E9F2` · 300 `#7FE0EC` · 400 `#45CDDE` · **500 `#1EB9CE`** · 600 `#0E9FB3` · 700 `#0B7F90` · 800 `#0C6470` · 900 `#0E4A55` |
| accent | 50 `#FFF2E8` · 100 `#FFE1CC` · 500 `#FF7A30` · 600 `#F2621A` · 700 `#D9541A` |
| ink | DEFAULT `#1A1A1A` · secondary `#6B6F76` · muted `#9A9EA5` · inverse `#FFFFFF` |
| canvas | DEFAULT `#FFFFFF` · subtle `#F2F3F5` |
| surface | `#FFFFFF` (chuỗi đơn, **không có khoá con**) |
| line | DEFAULT `#E6E8EB` · subtle `#EFF0F2` |
| success | DEFAULT `#16A34A` · soft `#DCFCE7` · strong `#15803D` |
| warning | DEFAULT `#F59E0B` · soft `#FEF3C7` · strong `#B45309` |
| danger | DEFAULT `#E5484D` · soft `#FEE2E2` · strong `#B91C1C` |
| info | DEFAULT `#3B82F6` · soft `#DBEAFE` · strong `#1D4ED8` |
| violet | soft `#EDE9FE` · strong `#6D28D9` |
| intro | teal `#22B8CF` · orange `#FF7A1A` · on-teal `#06323C` |
| rating | `#FFB400` |
| scrim | `rgba(0,0,0,0.45)` |

Ghi chú: `canvas.DEFAULT`, `surface` và `ink.inverse` cùng là `#FFFFFF`; `intro.teal #22B8CF` gần trùng `brand.500 #1EB9CE` nhưng là token riêng.

### 2.3 Chữ

| Token | Giá trị |
|---|---|
| fontFamily `body` / `body-medium` / `body-semibold` / `body-bold` | BeVietnamPro Regular / Medium / SemiBold / Bold |
| fontFamily `display` | Baloo2-ExtraBold |
| fontSize (cỡ / line-height, px) | micro 11/14 · caption 13/18 · body 14/20 · body-lg 16/22 · headline 18/24 · title 20/28 · display 26/32 |

Thành phần `Text` (`mobile/src/components/ui/Text.tsx`) ánh xạ `variant` → lớp cỡ chữ và độ đậm mặc định: display bold; title, headline, price semibold; body, body-lg regular; caption medium; micro semibold. `maxFontSizeMultiplier` mặc định 1.4.

### 2.4 Bo góc, bóng, kích thước

| Nhóm | Giá trị |
|---|---|
| radius | sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 (px) |
| shadow | card `0px 1px 4px rgba(0,0,0,0.06)` · raised 0 4 12 α .10 · float 0 10 30 α .12 · glow `0 6 16 rgba(30,185,206,.35)` |
| size | touch 44 · search-lg 52 · search 40 · button-lg 48 · button-md 40 · button-sm 32 · topbar 56 · tabbar 64 · fab 60 · chip 28 |

Trích `mobile/tailwind.config.js` (minh hoạ cách nạp):

```js
const tokens = require('./src/theme/tokens.json');
// ...
theme: { extend: {
  colors: tokens.colors,
  fontSize: /* [size, { lineHeight }] từ tokens.fontSize */,
  borderRadius: /* px từ tokens.radius */,
  boxShadow: tokens.shadow,
  height: tokens.size, minHeight: tokens.size, width: tokens.size, minWidth: tokens.size,
} }
```

(Đoạn trên rút gọn, chưa phải nguyên văn; xem file thật để biết cú pháp chính xác.)

### 2.5 Gradient

`mobile/src/components/ui/Gradient.tsx` dòng 8–30 (không dùng thư viện; RN 0.88 hỗ trợ `backgroundImage`):

| Preset | Định nghĩa | Nơi dùng |
|---|---|---|
| header | 180° brand-900 → brand-700 (30%) → brand-100 (58%) → canvas (78%) | HomeScreen dòng 285 |
| sectionBrand | 180° brand-50 → canvas 70% | **Không nơi nào dùng** |
| sectionHeaderBand | 180° brand-400 → brand-100 60% → canvas | HomeScreen dòng 380 |
| dealFrame | 160° accent-50 → canvas 55% → accent-100 | FeaturedCarousel dòng 119 |
| nearbyBand | 180° brand-200 → brand-100 45% → brand-50 | HomeScreen dòng 424 |
| tabHeader | 160° brand-900 → brand-700 55% → brand-500 | TabHeader.tsx dòng 25 (17 lần dùng TabHeader); OwnerStatsScreen dòng 59 dựng lại thủ công |
| sectionAccent | 180° accent-50 → canvas 70% | HomeScreen dòng 405 |
| empty | 135° warning-soft → canvas 50% → brand-100 | States.tsx dòng 52 (EmptyState biến thể card) |
| brandPill | 135° brand-300 → brand-500 | FloatingTabBar dòng 59 (tab đang chọn) và dòng 83 (nút giỏ nổi) |
| splash | 180° brand-900 → brand-700 55% → brand-700 | ZomZomSplashScreen dòng 114, LoginScreen dòng 108, RegisterScreen dòng 110 (kèm `bg-brand-800` làm nền dự phòng) |
| splashGlow | radial rgba(127,224,236,0.38) → 0 | ZomZomSplashScreen |
| imageScrim | 180° rgba(0,0,0,0) → rgba(0,0,0,0.55) | BannerCarousel dòng 90, RestaurantDetailScreen dòng 214 |

### 2.6 Bảng màu cũ còn sót

`mobile/src/constants/colors.ts`: primary `#EE4D2D`, primaryDark `#D03E1F`, primaryLight `#FFF0ED`, secondary `#26AA99`, background `#F8F9FA`, text `#1A1A1A`, textSecondary `#666666`, textMuted `#999999`, border `#E8E8E8`, borderLight `#F0F0F0`, success `#10B981`, warning `#F59E0B`, danger `#EF4444`, info `#3B82F6`, rating `#FBBF24`.

Đang được dùng bởi:

- `mobile/src/utils/orderStatus.ts` (`ORDER_STATUS_CONFIG.color/bgColor`, cộng hex viết cứng `#FEF3C7`, `#DBEAFE`, `#CCFBF1`, `#D1FAE5`, `#FEE2E2`).
- Các thành phần trong `mobile/src/components/common/` (StyleSheet) và `components/modules/RestaurantCard.tsx`, `OrderTimeline.tsx` — phần lớn không còn được màn nào dùng (xem 02).

Màu cũ khác token mới cho cùng ý nghĩa: danger `#EF4444` vs `#E5484D`; success `#10B981` vs `#16A34A`; rating `#FBBF24` vs `#FFB400`; textSecondary `#666666` vs `#6B6F76`.

### 2.7 Token có tên nhưng không dùng / dùng rất ít

Số lần = (số lớp NativeWind dùng token) / (số tham chiếu `palette.*` trong JS).

| Token | Lớp / palette | Ghi chú |
|---|---|---|
| `info` (DEFAULT) | 0 / 0 | Không dùng ở đâu. `info-soft` 2, `info-strong` 1 (OrderStatusBadge CONFIRMED). |
| `brand-900` | 0 / 3 | Chỉ dùng trong preset gradient. |
| `rating` | 0 / 4 | Chỉ qua palette (màu sao); chưa có lớp `text-rating`. Tone `rating` của Icon dùng 14 lần. |
| `accent-100` | 0 / 1 | Chỉ trong gradient dealFrame. |
| `brand-300`, `brand-700`, `accent-600`, `accent-700` | 1 lớp mỗi token | |
| `danger-strong` | 3 / 0 | |
| `violet-soft` / `violet-strong` | 2 / 0 · 1 / 1 | Chỉ cho trạng thái PREPARING. |
| `text-display` (cỡ) | 1 lớp + 5 qua variant | Variant `display` chỉ dùng 5 lần. |
| `size.search` / `button-md` / `tabbar` / `chip` | 1 lần mỗi token | |
| `shadow-raised` | 6 | |
| Thành phần `Card`, `StatCard`, `SheetHandle` của kit | 0 | Có định nghĩa nhưng không màn nào dùng. |

### 2.8 Giá trị dùng mà không có token

| Giá trị | Số lần | Ở đâu | Gần token nào |
|---|---:|---|---|
| `#1EB9CE` viết cứng | 17 | AppMapView.native, States.tsx (LoadingSpinner), DriverAvailableOrders, DriverDeliveries, DriverDeliveryDetail | Trùng giá trị `brand-500` nhưng không đi qua token |
| `#FFFFFF` viết cứng | 13 | AppMapView.native, colors.ts, các màn tài xế | `ink-inverse` / `surface` |
| `#EF4444` | 7 | AppMapView.native, colors.ts, màn tài xế (icon quán) | Khác `danger #E5484D` |
| `#10B981` | 4 | AppMapView.native, colors.ts, DriverAvailableOrders | Khác `success #16A34A` |
| `#64748B`, `#94A3B8` | 4, 3 | DriverDeliveries, DriverDeliveryDetail, DriverAvailableOrders | Màu slate của Tailwind, không có trong tokens (gần `ink-secondary`, `ink-muted`) |
| `#EAB308` | 1 | DriverVehicleScreen | Không có token vàng này (`warning #F59E0B`, `rating #FFB400`) |
| `#9A9EA5` | 1 | EditProfileScreen | Trùng `ink-muted` |
| `#EE4D2D`, `#EA580C` | 4, 3 | common/AppImage, RestaurantCard, colors.ts | Màu cam đỏ của bảng cũ |
| `text-white`, `bg-white/15`, `bg-white/25`, `bg-white/60`, `border-white/5…/20`, `bg-black/20`, `bg-black/65` | 5, 2, 1, 1, 3+3+3+3, 2, 1 | LoginScreen, RegisterScreen, ZomZomSplashScreen, SplashLogo, OwnerStatsScreen, SearchScreen, AddressPickerScreen | Màu mặc định Tailwind, ngoài tokens |
| Cỡ chữ `text-[9px]` … `text-[64px]` | 14 giá trị | Xem 3.3 | Ngoài thang `fontSize` |
| Bo góc `rounded-[6px]`, `[20px]`, `[22px]`, `[28px]`, `rounded-t-[32px]`, `rounded-3xl`, `rounded` | 1–6 | Choice (`[6px]`), Login/Register/SplashLogo (`[20px]`, `[22px]`, `[28px]`, `rounded-t-[32px]`), DriverDeliveryDetail dòng 1050 (`rounded-3xl`), AddAddress/AddressManagement/AddressPicker (`rounded`) | Ngoài thang `radius` của token; `rounded-3xl` và `rounded` là giá trị mặc định Tailwind (tính theo rem; giá trị px thực trên RN phụ thuộc cấu hình rem của NativeWind — chưa xác nhận) |

---

## 3. Thống kê giá trị thực tế

### 3.1 Màu

**Lớp màu dùng nhiều nhất** (tổng 111 lớp màu khác nhau; đủ ở 07 §13.1):

| Lớp | Số lần | Mục đích chính (suy luận theo ngữ cảnh) |
|---|---:|---|
| `bg-surface` | 153 | Nền thẻ, hàng danh sách |
| `bg-canvas-subtle` | 79 | Nền màn, nền ô nhập, nền vòng icon |
| `border-line` | 72 | Viền thẻ |
| `bg-brand-50` | 51 | Nền nhạt nút phụ, chip đang chọn, khối nhấn |
| `border-line-subtle` | 42 | Đường kẻ trong thẻ |
| `bg-brand-500` | 28 | Nút chính, điểm tiến trình |
| `bg-danger-soft` | 27 | Nền cảnh báo, huy hiệu lỗi |
| `text-ink` | 20 | Chữ thường (ngoài Text tone) |
| `border-brand-500` | 18 | Viền khi chọn/focus |
| `bg-warning-soft` | 17 | Cảnh báo, PENDING |
| `bg-line` | 17 | Vạch kẻ, thanh tiến trình chưa đạt |
| `bg-scrim` | 13 | Lớp tối sau Modal |
| `bg-success-soft` | 13 | Trạng thái thành công |
| `bg-canvas` | 13 | Nền màn trắng |
| `bg-surface-subtle` | 13 | **Không có token** (xem 3.8) |

**Mã hex/rgba viết cứng**: 39 mã hex, 5 rgba, 1 tên màu (`transparent` ×2). Bảng ở 2.8; đủ ở 07 §13.1.

**Tham chiếu `palette.*` trong JS** (cho `color=` của Ionicons, ActivityIndicator, RefreshControl…): nhiều nhất `palette.brand['500']` 38, `palette.ink.muted` 25, `palette.surface` 9. Đủ ở 07 §13.1.

### 3.2 Chữ màu xanh ngọc dùng làm màu chữ

Yêu cầu: tìm chữ màu xanh ngọc sáng (#22B8CF hoặc tương đương) dùng làm màu chữ.

| Cách tô | Màu thực | Số lần | Ghi chú |
|---|---|---:|---|
| `<Text tone="brand">` (kể cả tone có điều kiện) | `text-brand-600` = `#0E9FB3` | **81** trong 35 file | Nhiều nhất: DriverDeliveryDetail 9, OrderTracking 7, DriverAvailableOrders 6, CheckoutScreen 5, DriverDeliveries 5. Tương phản trên trắng **3.17:1**, trên brand-50 **2.95:1**. |
| Nhãn Button `secondary`/`ghost` | tone brand → `#0E9FB3` | (gộp trong Button 83 lần) | |
| `<Icon tone="brand">` | `#1EB9CE` (brand-500) | 47 | Biểu tượng, không phải chữ |
| `<Ionicons color="#1EB9CE">` / `palette.brand['500']` | `#1EB9CE` | 17 hex + 38 palette | Biểu tượng, spinner, marker bản đồ |
| `text-intro-teal`, `text-brand-400`, `text-brand-500` | — | **0** | Không có chữ nào tô trực tiếp #22B8CF/#1EB9CE. `intro-teal` chỉ dùng cho nền/viền ở Login, Register, SplashLogo (dòng 133, 133, 113). |

Kết luận sự thật: không có chữ tô đúng `#22B8CF`; màu chữ xanh ngọc thực tế là `#0E9FB3` (81 thẻ Text), đậm hơn một bậc so với màu biểu tượng `#1EB9CE`.

### 3.3 Cỡ chữ, độ đậm, họ chữ

**Variant của Text** (qua prop `variant`): caption 327 · body 148 · headline 57 · micro 53 · body-lg 31 · title 24 · display 5.

**Độ đậm** (`weight=`): bold 163 · semibold 85 · regular 73 · medium 48.

**Tone** (gộp Text và Icon): secondary 229 · brand 132 · muted 118 · inverse 71 · danger 67 · default 31 · accent 22 · success 20 · warning 17 · rating 14.

**Cỡ chữ tuỳ ý trong className** (ngoài thang token):

| Lớp | Số lần | Nơi |
|---|---:|---|
| `text-[9px]` | 1 | DriverDeliveriesScreen dòng 166 |
| `text-[10px]` | 1 | DriverDeliveryDetailScreen dòng 673 |
| `text-[11px]` | 2 | SearchScreen |
| `text-[13px]`, `text-[14px]`, `text-[15px]` | 1 mỗi | SearchScreen |
| `text-[17px]` | 2 | SearchScreen |
| `text-[30px]` | 2 | LoginScreen, RegisterScreen (tiêu đề) |
| `text-[34px]` | 1 | OwnerStatsScreen dòng 101 (Text của RN) |
| `text-[42px]`, `text-[44px]`, `text-[48px]`, `text-[64px]` | 1 mỗi | Logo chữ Z ở Login/Register/SplashLogo |

**Cỡ/độ đậm trong `style`** (các file StyleSheet cũ): fontSize 12px ×7, 14px ×5, 11px ×3…; fontWeight '700' ×7, '600' ×6.

**Họ chữ**: `font-display` 6 lần (logo, tiêu đề auth/splash), `font-bold` 3 lần (Tailwind mặc định, không trỏ tới BeVietnamPro Bold — chưa xác nhận hiển thị), `leading-[…]` ở màn auth và splash. Các thành phần StyleSheet cũ không đặt `fontFamily` (dùng font hệ thống — suy luận vì không thấy tham chiếu fontFamily trong `components/common`).

**Ngoại lệ đã ghi trong mã**: OwnerStatsScreen dòng 100: "Text của kit không ghi đè được cỡ chữ qua className, nên số lớn dùng Text của RN".

### 3.4 Khoảng cách

115 lớp khoảng cách khác nhau. Nhiều nhất: `gap-2` 192 · `gap-3` 132 · `px-4` 91 · `p-4` 70 · `gap-1` 66 · `gap-1.5` 60 · `px-3` 57 · `p-3` 48. Đủ ở 07 §13.3.

Quan sát: dùng song song `gap-1`, `gap-1.5`, `gap-2`, `gap-2.5`, `gap-3` (bước 4–12px, nửa bước 2px) và `px-3`/`px-3.5`/`px-4`. Lề màn hình chủ yếu `px-4` (16px) và `mx-4`.

### 3.5 Bo góc và bóng

| Bo góc | Số lần | | Bóng | Số lần |
|---|---:|---|---|---:|
| `rounded-full` | 147 | | `shadow-card` | 92 |
| `rounded-xl` (20) | 79 | | `shadow-float` | 15 |
| `rounded-lg` (16) | 60 | | `shadow-glow` | 9 |
| `rounded-2xl` (24) | 56 | | `shadow-none` | 7 |
| `rounded-md` (12) | 32 | | `shadow-raised` | 6 |
| `rounded-sm` (8) | 7 | | | |
| `rounded` (mặc định Tailwind) | 6 | | | |
| `rounded-none` | 3 | | | |
| `rounded-t-[32px]` | 2 | | | |
| `rounded-[6px]`, `[20px]`, `[22px]`, `[28px]`, `rounded-3xl` | 1 mỗi | | | |

Thẻ cùng loại dùng bo khác nhau: thẻ ở các màn tài xế `rounded-2xl` (24px), thẻ admin/owner phần lớn `rounded-xl` (20px), `Card` của kit `rounded-lg` (16px) — suy luận từ phân bố, chưa kiểm từng thẻ.

`shadow-none` 7 lần chủ yếu là cách tránh lỗi NativeWind remount khi lớp bóng có điều kiện (xem comment ChatScreen dòng 278).

### 3.6 File dùng StyleSheet / style inline

**Chiến lược chung**: 75/95 file `.tsx` dùng `className` (NativeWind). 11 file dùng `StyleSheet.create`, 20 file có `style={{…}}` inline.

| File dùng `StyleSheet.create` | Còn được dùng? |
|---|---|
| `mobile/src/components/common/AppImage.tsx` | Chỉ bởi `modules/RestaurantCard.tsx` (bản thân không được dùng) |
| `mobile/src/components/common/AppMapView.native.tsx` | **Có** — OrderTrackingScreen, DriverDeliveryDetailScreen |
| `mobile/src/components/common/AppMapView.web.tsx` | Có (bản web) |
| `mobile/src/components/common/Badge.tsx`, `Button.tsx`, `Card.tsx`, `EmptyState.tsx`, `Input.tsx`, `LoadingSpinner.tsx` | Không màn nào import (Card chỉ bởi RestaurantCard không dùng) |
| `mobile/src/components/modules/OrderTimeline.tsx`, `RestaurantCard.tsx` | Không được dùng |

Style inline nhiều nhất: SearchScreen 8, RatingScreen 5, AddAddressScreen 4 (đủ ở 07 §13.8). Phần lớn là `contentContainerStyle` của ScrollView/FlatList và chiều rộng động (thanh biểu đồ).

### 3.7 File dùng giá trị tuỳ ý

23 file có lớp `[...]`. Tập trung ở: LoginScreen, RegisterScreen, ZomZomSplashScreen, SplashLogo (logo, tiêu đề lớn, bo góc riêng); SearchScreen (7 cỡ chữ); OwnerMenuScreen (`flex-[2]`, `min-w-[56px]`, `h-[72px]`); ChatScreen (`max-w-[80%]`, `min-h-[42px]`); AddAddressScreen (`h-[1px]` ×4, `min-h-[90px]`); DishOptionSheet (`max-h-[520px]`); Overlays (`max-h-[90%]`). Danh sách đủ kèm số dòng ở 07 §13.4.

### 3.8 Lớp không sinh ra style

Đối chiếu từng lớp với `tokens.json` + thang mặc định Tailwind 3.4:

| Lớp | Số lần | Lý do | Vị trí |
|---|---:|---|---|
| `bg-surface-subtle` | 13 | `surface` là chuỗi màu đơn, không có khoá `subtle` → lớp không tồn tại (nhiều khả năng không có nền; **chưa xác nhận trên thiết bị**) | DriverAvailableOrdersScreen 328, 419, 445; DriverDeliveriesScreen 179, 293, 308, 331; DriverDeliveryDetailScreen 481, 783, 803, 918, 1063; DriverVehicleScreen 161 |

Các lớp `gap-x-*`/`gap-y-*` (15 lần) là lớp hợp lệ của Tailwind; script ban đầu báo nhầm, đã loại.
