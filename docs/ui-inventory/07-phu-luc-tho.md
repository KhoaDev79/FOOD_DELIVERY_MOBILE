# Phụ lục 07 — Thống kê thô nguyên bản từ mã nguồn (mục 13)

[← Về tài liệu chính](../UI_DESIGN_INVENTORY.md) | [← Về Phụ lục 01: Tokens & Thống kê](01-tokens-va-thong-ke.md)

Tài liệu này lưu trữ toàn bộ dữ liệu quét thô không qua chỉnh sửa từ mã nguồn dự án mobile ZomZom, phục vụ việc đối soát và lập kế hoạch tái cấu trúc giao diện.

---

## 13.1 Toàn bộ bảng màu xuất hiện trong mã nguồn

| Mã màu / Tên lớp | Loại giá trị | Số lần xuất hiện | Các file tiêu biểu | Mục đích sử dụng chính |
|---|---|---:|---|---|
| `#1EB9CE` | Hex | 55 | `tokens.json`, `DriverDeliveryDetailScreen`, `Icon.tsx` | Màu nhận diện thương hiệu chính ZomZom (brand-500) |
| `#0E9FB3` | Hex / Token | 81 | `tokens.json`, `Text.tsx`, các màn hình | Màu chữ xanh ngọc tương phản cao (`brand-600`) cho `<Text tone="brand">` |
| `#FFFFFF` / `white` | Hex / Token | 240+ | Khắp codebase, `FloatingTabBar`, `Card`, `Button` | Màu nền thẻ, màu chữ trên nền tối/gradient |
| `#1A1A1A` | Hex / Token | 180+ | `tokens.json`, `Text.tsx`, `Input.tsx` | Màu chữ chính (`ink.DEFAULT`) |
| `#6B6F76` | Hex / Token | 150+ | `tokens.json`, `Text.tsx`, `Icon.tsx` | Màu chữ phụ, icon phụ (`ink.secondary`) |
| `#9A9EA5` | Hex / Token | 90+ | `tokens.json`, placeholder, thời gian | Màu chữ mờ, ghi chú (`ink.muted`) |
| `#E6E8EB` | Hex / Token | 110+ | `tokens.json`, viền thẻ, phân cách | Màu đường kẻ viền chính (`line.DEFAULT`) |
| `#EFF0F2` | Hex / Token | 45 | `tokens.json`, `Divider.tsx`, `ListRow.tsx` | Đường phân cách nhạt (`line.subtle`) |
| `#F2F3F5` | Hex / Token | 85 | `tokens.json`, nền input, nền màn | Nền xám nhạt (`canvas.subtle`) |
| `#16A34A` / `success` | Hex / Token | 35 | `tokens.json`, trạng thái hoàn thành | Màu xanh lá thành công (`success.DEFAULT`) |
| `#DCFCE7` | Hex / Token | 28 | `tokens.json`, `Badge.tsx` | Nền xanh lá nhạt (`success.soft`) |
| `#15803D` | Hex / Token | 22 | `tokens.json`, nhãn badge | Chữ xanh lá đậm (`success.strong`) |
| `#F59E0B` / `warning` | Hex / Token | 40 | `tokens.json`, đơn chờ duyệt | Màu vàng hổ phách cảnh báo (`warning.DEFAULT`) |
| `#FEF3C7` | Hex / Token | 32 | `tokens.json`, `Badge.tsx` | Nền vàng nhạt cảnh báo (`warning.soft`) |
| `#B45309` | Hex / Token | 25 | `tokens.json`, nhãn badge | Chữ vàng đậm cảnh báo (`warning.strong`) |
| `#E5484D` / `danger` | Hex / Token | 50 | `tokens.json`, nút đăng xuất, đơn huỷ | Màu đỏ báo lỗi, nút nguy hiểm (`danger.DEFAULT`) |
| `#FEE2E2` | Hex / Token | 38 | `tokens.json`, `Badge.tsx` | Nền đỏ nhạt (`danger.soft`) |
| `#B91C1C` | Hex / Token | 30 | `tokens.json`, nhãn đơn huỷ | Chữ đỏ đậm (`danger.strong`) |
| `#3B82F6` / `info` | Hex / Token | 25 | `tokens.json`, đơn đã nhận | Màu xanh dương thông tin (`info.DEFAULT`) |
| `#DBEAFE` | Hex / Token | 20 | `tokens.json`, `Badge.tsx` | Nền xanh dương nhạt (`info.soft`) |
| `#1D4ED8` | Hex / Token | 18 | `tokens.json`, nhãn badge | Chữ xanh dương đậm (`info.strong`) |
| `#EDE9FE` / `violet.soft` | Hex / Token | 15 | `tokens.json`, `Badge.tsx` | Nền tím nhạt cho đơn đang chuẩn bị |
| `#6D28D9` / `violet.strong`| Hex / Token | 15 | `tokens.json`, `Badge.tsx` | Chữ tím đậm cho đơn đang chuẩn bị |
| `#FF7A30` / `accent-500` | Hex / Token | 35 | `tokens.json`, deal sốc, chấm cam | Màu cam điểm nhấn phụ (`accent.500`) |
| `#FFF2E8` / `accent-50` | Hex / Token | 18 | `tokens.json`, deal sốc | Nền cam nhạt (`accent.50`) |
| `#22B8CF` | Hex | 4 | `tokens.json`, `SplashLogo.tsx` | Màu xanh ngọc sáng mở đầu (`intro.teal`) |
| `#FF7A1A` | Hex | 3 | `tokens.json`, `SplashLogo.tsx` | Màu cam sáng mở đầu (`intro.orange`) |
| `#06323C` | Hex | 2 | `tokens.json` | Màu chữ trên nền intro (`intro.on-teal`) |
| `#FFB400` | Hex / Token | 14 | `tokens.json`, `Icon.tsx`, `RatingScreen` | Màu vàng đánh giá số sao (`rating`) |
| `#EE4D2D` | Hex (cũ) | 4 | `colors.ts`, `app.json`, `orderStatus.ts` | Màu cam đỏ cũ chưa dọn sạch |
| `rgba(0,0,0,0.45)` | RGBA | 8 | `tokens.json`, `Overlays.tsx` | Lớp màn che mờ đáy modal (`scrim`) |

---

## 13.2 Thống kê các kiểu chữ và kích thước chữ

### A. Phân bổ theo prop `variant` của `<Text>`
1. `caption` (13px / 18px line-height): **327 lần**
2. `body` (14px / 20px line-height): **148 lần**
3. `headline` (18px / 24px line-height): **57 lần**
4. `micro` (11px / 14px line-height): **53 lần**
5. `body-lg` (16px / 22px line-height): **31 lần**
6. `title` (20px / 28px line-height): **24 lần**
7. `display` (26px / 32px line-height): **5 lần**

### B. Phân bổ theo prop `weight` của `<Text>`
1. `bold` (font-body-bold / 700): **163 lần**
2. `semibold` (font-body-semibold / 600): **85 lần**
3. `regular` (font-body / 400): **73 lần**
4. `medium` (font-body-medium / 500): **48 lần**

### C. Các cỡ chữ viết tay tuỳ ý ngoài thang token
- `text-[9px]`: 1 lần (`DriverDeliveriesScreen.tsx` dòng 166)
- `text-[10px]`: 1 lần (`DriverDeliveryDetailScreen.tsx` dòng 673)
- `text-[11px]`: 2 lần (`SearchScreen.tsx`)
- `text-[13px]`: 1 lần (`SearchScreen.tsx`)
- `text-[14px]`: 1 lần (`SearchScreen.tsx`)
- `text-[15px]`: 1 lần (`SearchScreen.tsx`)
- `text-[17px]`: 2 lần (`SearchScreen.tsx`)
- `text-[30px]`: 2 lần (`LoginScreen.tsx`, `RegisterScreen.tsx`)
- `text-[34px]`: 1 lần (`OwnerStatsScreen.tsx` dòng 101)
- `text-[42px]`, `text-[44px]`, `text-[48px]`, `text-[64px]`: 1 lần mỗi lớp (Logo chữ Z tại Splash & Auth)

---

## 13.3 Top 50 lớp className phổ biến nhất

```
 1. flex-row            (365 lần)
 2. items-center        (361 lần)
 3. flex-1              (294 lần)
 4. gap-2               (178 lần)
 5. bg-surface          (127 lần)
 6. rounded-full        (111 lần)
 7. gap-3               (108 lần)
 8. justify-center      (90 lần)
 9. border              (85 lần)
10. justify-between     (80 lần)
11. shadow-card         (77 lần)
12. px-4                (76 lần)
13. bg-canvas-subtle    (71 lần)
14. rounded-xl          (66 lần)
15. p-4                 (63 lần)
16. gap-1               (63 lần)
17. border-line         (62 lần)
18. absolute            (61 lần)
19. gap-1.5             (56 lần)
20. rounded-2xl         (52 lần)
21. px-3                (50 lần)
22. rounded-lg          (50 lần)
23. p-3                 (38 lần)
24. border-line-subtle  (38 lần)
25. bg-brand-50         (38 lần)
26. gap-0.5             (37 lần)
27. text-center         (34 lần)
28. items-start         (33 lần)
29. mt-1                (32 lần)
30. py-2                (28 lần)
31. border-t            (28 lần)
32. w-full              (28 lần)
33. gap-2.5             (26 lần)
34. flex-wrap           (26 lần)
35. rounded-md          (25 lần)
36. uppercase           (22 lần)
37. py-1                (22 lần)
38. min-h-touch         (21 lần)
39. gap-4               (21 lần)
40. active:opacity-70   (20 lần)
41. mt-3                (19 lần)
42. overflow-hidden     (19 lần)
43. pb-3                (18 lần)
44. text-ink            (18 lần)
45. pb-2                (17 lần)
46. pt-3                (16 lần)
47. mt-2                (16 lần)
48. shadow-float        (15 lần)
49. border-b            (15 lần)
50. bg-danger-soft      (15 lần)
```

---

## 13.4 Danh sách 23 file sử dụng giá trị tuỳ ý trong className `[...]`

1. `mobile/src/screens/intro/SplashLogo.tsx` — `rounded-[22px]`, `w-[76px]`, `h-[76px]`, `text-[48px]`, `leading-[48px]`
2. `mobile/src/screens/intro/ZomZomSplashScreen.tsx` — `text-[42px]`, `h-[6px]`, `h-[14px]`
3. `mobile/src/screens/auth/LoginScreen.tsx` — `text-[30px]`, `text-[44px]`
4. `mobile/src/screens/auth/RegisterScreen.tsx` — `text-[30px]`
5. `mobile/src/screens/search/SearchScreen.tsx` — 7 cỡ chữ tuỳ ý: `text-[11px]`, `text-[13px]`, `text-[14px]`, `text-[15px]`, `text-[17px]`
6. `mobile/src/screens/owner/OwnerStatsScreen.tsx` — `text-[34px]`
7. `mobile/src/screens/owner/OwnerMenuScreen.tsx` — `flex-[2]`, `min-w-[56px]`, `h-[72px]`, `h-[1px]`
8. `mobile/src/screens/chat/ChatScreen.tsx` — `max-w-[80%]`, `min-h-[42px]`, `text-[15px]`
9. `mobile/src/screens/profile/AddAddressScreen.tsx` — `h-[1px]` (4 lần), `min-h-[90px]`
10. `mobile/src/components/modules/restaurant/DishOptionSheet.tsx` — `max-h-[520px]`
11. `mobile/src/components/ui/Overlays.tsx` — `max-h-[90%]`, `max-w-[90%]`
12. `mobile/src/screens/driver/DriverDeliveriesScreen.tsx` — `text-[9px]`
13. `mobile/src/screens/driver/DriverDeliveryDetailScreen.tsx` — `text-[10px]`, `h-[1px]`
14. `mobile/src/screens/order/OrderTrackingScreen.tsx` — `h-[1px]`
15. `mobile/src/screens/home/HomeScreen.tsx` — `w-[110px]`, `h-[110px]`
16. `mobile/src/components/modules/home/FeaturedCarousel.tsx` — `w-[280px]`
17. `mobile/src/components/modules/home/DishCard.tsx` — `w-[140px]`, `h-[100px]`
18. `mobile/src/components/modules/home/BannerCarousel.tsx` — `h-[140px]`
19. `mobile/src/components/modules/restaurant/RestaurantCards.tsx` — `w-[240px]`
20. `mobile/src/components/modules/CartItem.tsx` — `h-[1px]`
21. `mobile/src/screens/profile/ProfileScreen.tsx` — `h-[1px]`
22. `mobile/src/screens/profile/AddressPickerScreen.tsx` — `h-[1px]`
23. `mobile/src/screens/driver/DriverVehicleScreen.tsx` — `h-[1px]`

---

## 13.5 File còn sử dụng StyleSheet hoặc Style Inline

### A. File sử dụng `StyleSheet.create` (11 file)
1. `mobile/src/components/common/AppMapView.native.tsx` (đang dùng thực tế)
2. `mobile/src/components/common/AppMapView.web.tsx` (đang dùng trên web)
3. `mobile/src/components/common/AppImage.tsx` (bộ cũ)
4. `mobile/src/components/common/Button.tsx` (bộ cũ)
5. `mobile/src/components/common/Card.tsx` (bộ cũ)
6. `mobile/src/components/common/Badge.tsx` (bộ cũ)
7. `mobile/src/components/common/Input.tsx` (bộ cũ)
8. `mobile/src/components/common/EmptyState.tsx` (bộ cũ)
9. `mobile/src/components/common/LoadingSpinner.tsx` (bộ cũ)
10. `mobile/src/components/modules/OrderTimeline.tsx` (bộ cũ, không dùng)
11. `mobile/src/components/modules/RestaurantCard.tsx` (bộ cũ, không dùng)

### B. File có `style={{...}}` inline đáng kể (20 file)
1. `SearchScreen.tsx`: 8 chỗ (chủ yếu là `contentContainerStyle` và thanh biểu đồ)
2. `RatingScreen.tsx`: 5 chỗ
3. `AddAddressScreen.tsx`: 4 chỗ
4. `Gradient.tsx`: 1 chỗ bắt buộc (để nạp thuộc tính `backgroundImage` của React Native 0.88)
5. `Skeleton.tsx`: 1 chỗ (style hoạt hình Reanimated)
6. `SplashLogo.tsx`: 4 chỗ (style hoạt hình Reanimated)
7. `ZomZomSplashScreen.tsx`: 3 chỗ (style hoạt hình Reanimated)
8. `Overlays.tsx`: 2 chỗ (style hoạt hình Reanimated)

---

## 13.6 Danh sách các chỗ dùng chữ màu xanh ngọc

Chữ xanh ngọc thực tế trong ứng dụng được định dạng qua `<Text tone="brand">` với màu `#0E9FB3` (`brand-600`), xuất hiện tại **81 thẻ Text** trên 35 file:
- `DriverDeliveryDetailScreen.tsx`: 9 lần
- `OrderTrackingScreen.tsx`: 7 lần
- `DriverAvailableOrdersScreen.tsx`: 6 lần
- `CheckoutScreen.tsx`: 5 lần
- `DriverDeliveriesScreen.tsx`: 5 lần
- `OwnerOrdersScreen.tsx`: 4 lần
- `HomeScreen.tsx`: 4 lần
- `CartScreen.tsx`: 3 lần
- `DriverWalletScreen.tsx`: 3 lần
- Các file khác: 1 đến 2 lần mỗi file.

---

## 13.7 Số lần dùng từng thành phần dùng chung (Kit components)

1. `Text` (`Text.tsx`): **655 lần** (67 file)
2. `Icon` (`Icon.tsx`): **167 lần**
3. `Button` (`Button.tsx`): **83 lần** (35 file)
4. `Input` (`Input.tsx`): **52 lần**
5. `Badge` (`Badge.tsx`): **39 lần**
6. `EmptyState` (`States.tsx`): **28 lần**
7. `Skeleton` (`Skeleton.tsx`): **28 lần**
8. `ListRow` (`ListRow.tsx`): **27 lần**
9. `AppImage` (`AppImage.tsx`): **24 lần**
10. `LoadingSpinner` (`States.tsx`): **20 lần**
11. `Divider` (`ListRow.tsx`): **20 lần**
12. `FilterChip` (`Chip.tsx`): **19 lần**
13. `IconButton` (`IconButton.tsx`): **18 lần**
14. `TopBar` (`TopBar.tsx`): **18 lần**
15. `BottomSheet` (`Overlays.tsx`): **18 lần**
16. `TabHeader` (`TabHeader.tsx`): **17 lần**
17. `Gradient` (`Gradient.tsx`): **16 lần**
18. `ConfirmDialog` (`Overlays.tsx`): **15 lần**
19. `OrderStatusBadge` (`Badge.tsx`): **11 lần**
20. `Avatar` (`Avatar.tsx`): **8 lần**
21. `CountBadge` (`Badge.tsx`): **8 lần**
22. `SearchBar` (`SearchBar.tsx`): **7 lần**
23. `ErrorState` (`States.tsx`): **7 lần**
24. `FormInput` (`Input.tsx`): **7 lần**
25. `FloatingTabBar` (`FloatingTabBar.tsx`): **4 lần** (1 lần mỗi navigator)
26. `ChoiceRow` / `ChoiceGroup` (`Choice.tsx`): **4 / 3 lần**
27. `QuantityStepper` (`QuantityStepper.tsx`): **3 lần**
28. `InfoChip` (`Chip.tsx`): **3 lần**
29. `SectionHeader` (`SectionHeader.tsx`): **2 lần** (chỉ ở HomeScreen)
30. `FilterBar` (`Admin.tsx`): **1 lần** (chỉ ở OrderHistoryScreen)
31. `Card` (`Card.tsx`): **0 lần** (không dùng)
32. `StatCard` (`Admin.tsx`): **0 lần** (không dùng)
33. `SheetHandle` (`Overlays.tsx`): **0 lần** (không dùng)

---

## 13.8 Danh sách toàn bộ 95 tệp giao diện (.tsx) kèm số dòng

| STT | Đường dẫn tệp | Số dòng | Nhóm tệp |
|:---:|---|---:|---|
| 1 | `mobile/src/screens/driver/DriverDeliveryDetailScreen.tsx` | 1098 | Màn hình Tài xế |
| 2 | `mobile/src/screens/owner/OwnerRestaurantScreen.tsx` | 691 | Màn hình Chủ quán |
| 3 | `mobile/src/screens/checkout/CheckoutScreen.tsx` | 691 | Màn hình Khách hàng |
| 4 | `mobile/src/screens/owner/OwnerMenuScreen.tsx` | 679 | Màn hình Chủ quán |
| 5 | `mobile/src/screens/driver/DriverAvailableOrdersScreen.tsx` | 645 | Màn hình Tài xế |
| 6 | `mobile/src/screens/owner/OwnerOrdersScreen.tsx` | 610 | Màn hình Chủ quán |
| 7 | `mobile/src/screens/order/OrderTrackingScreen.tsx` | 570 | Màn hình Khách hàng |
| 8 | `mobile/src/screens/home/HomeScreen.tsx` | 530 | Màn hình Khách hàng |
| 9 | `mobile/src/screens/restaurant/RestaurantDetailScreen.tsx` | 506 | Màn hình Khách hàng |
| 10 | `mobile/src/screens/admin/AdminRestaurantsScreen.tsx` | 464 | Màn hình Admin |
| 11 | `mobile/src/screens/driver/DriverProfileScreen.tsx` | 459 | Màn hình Tài xế |
| 12 | `mobile/src/screens/profile/AddressPickerScreen.tsx` | 456 | Màn hình Dùng chung |
| 13 | `mobile/src/screens/admin/AdminOrdersScreen.tsx` | 439 | Màn hình Admin |
| 14 | `mobile/src/screens/driver/DriverDeliveriesScreen.tsx` | 397 | Màn hình Tài xế |
| 15 | `mobile/src/screens/admin/AdminUsersScreen.tsx` | 384 | Màn hình Admin |
| 16 | `mobile/src/screens/admin/AdminDashboardScreen.tsx` | 349 | Màn hình Admin |
| 17 | `mobile/src/screens/profile/AddAddressScreen.tsx` | 340 | Màn hình Khách hàng |
| 18 | `mobile/src/screens/driver/DriverVehicleScreen.tsx` | 339 | Màn hình Tài xế |
| 19 | `mobile/src/screens/chat/InboxScreen.tsx` | 329 | Màn hình Dùng chung |
| 20 | `mobile/src/screens/search/SearchScreen.tsx` | 298 | Màn hình Khách hàng |
| 21 | `mobile/src/screens/chat/ChatScreen.tsx` | 296 | Màn hình Dùng chung |
| 22 | `mobile/src/screens/owner/OwnerStatsScreen.tsx` | 293 | Màn hình Chủ quán |
| 23 | `mobile/src/screens/rating/RatingScreen.tsx` | 259 | Màn hình Khách hàng |
| 24 | `mobile/src/screens/profile/EditProfileScreen.tsx` | 259 | Màn hình Dùng chung |
| 25 | `mobile/src/screens/profile/ProfileScreen.tsx` | 246 | Màn hình Khách hàng |
| 26 | `mobile/src/screens/order/OrderHistoryScreen.tsx` | 245 | Màn hình Khách hàng |
| 27 | `mobile/src/screens/driver/DriverReviewsScreen.tsx` | 244 | Màn hình Tài xế |
| 28 | `mobile/src/screens/profile/RoleUpgradeRequestScreen.tsx` | 240 | Màn hình Khách hàng |
| 29 | `mobile/src/components/modules/admin/DriverVerifySheet.tsx` | 240 | Thành phần Nghiệp vụ |
| 30 | `mobile/src/screens/auth/LoginScreen.tsx` | 239 | Màn hình Xác thực |
| 31 | `mobile/src/screens/profile/AddressManagementScreen.tsx` | 236 | Màn hình Khách hàng |
| 32 | `mobile/src/screens/auth/RegisterScreen.tsx` | 228 | Màn hình Xác thực |
| 33 | `mobile/src/screens/owner/OwnerReviewsScreen.tsx` | 227 | Màn hình Chủ quán |
| 34 | `mobile/src/screens/driver/DriverWalletScreen.tsx` | 223 | Màn hình Tài xế |
| 35 | `mobile/src/components/modules/chat/ChatNotifier.tsx` | 223 | Thành phần Nghiệp vụ |
| 36 | `mobile/src/components/modules/RestaurantCard.tsx` | 215 | Thành phần cũ |
| 37 | `mobile/src/components/modules/restaurant/RestaurantCards.tsx` | 207 | Thành phần Nghiệp vụ |
| 38 | `mobile/src/screens/intro/ZomZomSplashScreen.tsx` | 182 | Màn hình Khởi động |
| 39 | `mobile/src/screens/cart/CartScreen.tsx` | 177 | Màn hình Khách hàng |
| 40 | `mobile/src/components/ui/Overlays.tsx` | 172 | Thành phần Kit |
| 41 | `mobile/src/components/modules/restaurant/DishOptionSheet.tsx` | 172 | Thành phần Nghiệp vụ |
| 42 | `mobile/src/components/modules/home/FeaturedCarousel.tsx` | 166 | Thành phần Nghiệp vụ |
| 43 | `mobile/src/components/modules/admin/RestaurantDetailSheet.tsx` | 163 | Thành phần Nghiệp vụ |
| 44 | `mobile/src/components/modules/OrderTimeline.tsx` | 163 | Thành phần cũ |
| 45 | `mobile/src/components/modules/admin/AssignOwnerSheet.tsx` | 162 | Thành phần Nghiệp vụ |
| 46 | `mobile/src/components/modules/admin/RoleRequestsSheet.tsx` | 157 | Thành phần Nghiệp vụ |
| 47 | `mobile/src/components/modules/home/DishCard.tsx` | 156 | Thành phần Nghiệp vụ |
| 48 | `mobile/src/screens/favorites/FavoritesScreen.tsx` | 153 | Màn hình Khách hàng |
| 49 | `mobile/src/components/common/Button.tsx` | 151 | Thành phần cũ |
| 50 | `mobile/src/screens/intro/SplashLogo.tsx` | 151 | Màn hình Khởi động |
| 51 | `mobile/src/components/common/AppMapView.native.tsx` | 142 | Thành phần Bản đồ |
| 52 | `mobile/src/components/modules/chat/ChatOrderCard.tsx` | 141 | Thành phần Nghiệp vụ |
| 53 | `mobile/src/components/modules/admin/UserActivitySheet.tsx` | 135 | Thành phần Nghiệp vụ |
| 54 | `mobile/src/components/modules/admin/adminShared.tsx` | 131 | Thành phần Nghiệp vụ |
| 55 | `mobile/src/screens/admin/AdminProfileScreen.tsx` | 130 | Màn hình Admin |
| 56 | `mobile/src/components/modules/home/BannerCarousel.tsx` | 123 | Thành phần Nghiệp vụ |
| 57 | `mobile/src/navigation/RootStack.tsx` | 116 | Điều hướng |
| 58 | `mobile/src/components/common/AppImage.tsx` | 115 | Thành phần cũ |
| 59 | `mobile/src/components/ui/Button.tsx` | 113 | Thành phần Kit |
| 60 | `mobile/src/components/ui/Input.tsx` | 111 | Thành phần Kit |
| 61 | `mobile/src/components/ui/Badge.tsx` | 103 | Thành phần Kit |
| 62 | `mobile/src/navigation/DriverTabNavigator.tsx` | 103 | Điều hướng |
| 63 | `mobile/src/components/ui/FloatingTabBar.tsx` | 91 | Thành phần Kit |
| 64 | `mobile/src/components/ui/States.tsx` | 91 | Thành phần Kit |
| 65 | `mobile/src/components/modules/restaurant/DishRow.tsx` | 83 | Thành phần Nghiệp vụ |
| 66 | `mobile/src/components/ui/ListRow.tsx` | 80 | Thành phần Kit |
| 67 | `mobile/src/components/ui/Choice.tsx` | 78 | Thành phần Kit |
| 68 | `mobile/App.tsx` | 77 | Điểm vào ứng dụng |
| 69 | `mobile/src/components/ui/Text.tsx` | 77 | Thành phần Kit |
| 70 | `mobile/src/components/ui/Chip.tsx` | 75 | Thành phần Kit |
| 71 | `mobile/src/components/ui/SearchBar.tsx` | 72 | Thành phần Kit |
| 72 | `mobile/src/components/common/AppMapView.web.tsx` | 71 | Thành phần Bản đồ |
| 73 | `mobile/src/components/ui/Admin.tsx` | 70 | Thành phần Kit |
| 74 | `mobile/src/components/ui/IconButton.tsx` | 70 | Thành phần Kit |
| 75 | `mobile/src/components/ui/QuantityStepper.tsx` | 70 | Thành phần Kit |
| 76 | `mobile/src/components/common/EmptyState.tsx` | 69 | Thành phần cũ |
| 77 | `mobile/src/components/ui/AppImage.tsx` | 68 | Thành phần Kit |
| 78 | `mobile/src/components/common/Input.tsx` | 67 | Thành phần cũ |
| 79 | `mobile/src/components/modules/CartItem.tsx` | 65 | Thành phần Nghiệp vụ |
| 80 | `mobile/src/navigation/OwnerTabNavigator.tsx` | 61 | Điều hướng |
| 81 | `mobile/src/components/ui/TopBar.tsx` | 60 | Thành phần Kit |
| 82 | `mobile/src/components/common/Badge.tsx` | 54 | Thành phần cũ |
| 83 | `mobile/src/components/ui/Skeleton.tsx` | 50 | Thành phần Kit |
| 84 | `mobile/src/components/ui/Avatar.tsx` | 49 | Thành phần Kit |
| 85 | `mobile/src/components/ui/SectionHeader.tsx` | 49 | Thành phần Kit |
| 86 | `mobile/src/navigation/AdminTabNavigator.tsx` | 48 | Điều hướng |
| 87 | `mobile/src/components/ui/Gradient.tsx` | 47 | Thành phần Kit |
| 88 | `mobile/src/navigation/AppNavigator.tsx` | 47 | Điều hướng |
| 89 | `mobile/src/components/ui/Card.tsx` | 47 | Thành phần Kit |
| 90 | `mobile/src/components/ui/TabHeader.tsx` | 45 | Thành phần Kit |
| 91 | `mobile/src/components/common/Card.tsx` | 41 | Thành phần cũ |
| 92 | `mobile/src/components/ui/Icon.tsx` | 41 | Thành phần Kit |
| 93 | `mobile/src/navigation/BottomTabNavigator.tsx` | 39 | Điều hướng |
| 94 | `mobile/src/components/common/LoadingSpinner.tsx` | 31 | Thành phần cũ |
| 95 | `mobile/src/components/common/AppMapView.tsx` | 2 | Thành phần Bản đồ |

