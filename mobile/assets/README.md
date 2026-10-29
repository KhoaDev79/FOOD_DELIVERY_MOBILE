# assets

Thư mục chứa icon, splash và hình ảnh tĩnh của ứng dụng.

`app.json` hiện **không** khai báo `icon` / `splash` để tránh lỗi build khi chưa có file.
Khi có thiết kế chính thức, thêm:

- `icon.png` (1024x1024) → `expo.icon`
- `adaptive-icon.png` (1024x1024, nền trong suốt) → `expo.android.adaptiveIcon.foregroundImage`
- `splash.png` → plugin `expo-splash-screen`
