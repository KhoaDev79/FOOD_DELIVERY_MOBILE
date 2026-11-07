/**
 * Đóng gói bản web vào thư mục dist (dùng chung cho deploy tay và cho Vercel tự build khi push lên GitHub).
 *
 * Địa chỉ backend lấy từ biến EXPO_PUBLIC_API_URL (trên Vercel: Settings → Environment Variables;
 * trên máy: file mobile/.env hoặc tham số --api của deploy-web.js).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Trên Vercel không có file .env: thiếu địa chỉ backend thì dừng luôn, tránh đưa lên bản web gọi nhầm localhost
if (process.env.VERCEL && !process.env.EXPO_PUBLIC_API_URL) {
  console.error('Thiếu biến EXPO_PUBLIC_API_URL trên Vercel (Settings → Environment Variables).');
  process.exit(1);
}

const res = spawnSync('npx', ['expo', 'export', '-p', 'web'], { stdio: 'inherit', shell: true, cwd: root });
if (res.status !== 0) process.exit(res.status ?? 1);

/**
 * Vercel luôn bỏ qua mọi thư mục tên "node_modules", mà Expo lại để font biểu tượng (Ionicons...)
 * ở dist/assets/node_modules/... → trên web biểu tượng thành ô vuông.
 * Đổi tên thành "vendor"; vercel.json chuyển đường dẫn cũ /assets/node_modules/* sang /assets/vendor/*.
 * KHÔNG sửa file JS: tên file JS có mã hash và được trình duyệt lưu 1 năm, sửa nội dung mà giữ tên sẽ bị dùng bản cũ.
 */
const distDir = path.join(root, 'dist');
const from = path.join(distDir, 'assets', 'node_modules');
if (fs.existsSync(from)) {
  const to = path.join(distDir, 'assets', 'vendor');
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
  console.log('Đã chuyển font/ảnh trong assets/node_modules sang assets/vendor.');
}
