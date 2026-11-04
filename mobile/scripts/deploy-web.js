/**
 * Đóng gói bản web và đưa lên Vercel (dự án đã liên kết trong .vercel/project.json).
 *
 * Cách chạy (PowerShell, trong thư mục mobile):
 *   npm run deploy:web                                   → dùng EXPO_PUBLIC_API_URL trong .env
 *   npm run deploy:web -- --api https://abc.trycloudflare.com   → dùng backend này (không sửa .env)
 *   thêm --preview để tạo bản xem thử thay vì bản chính
 *
 * Địa chỉ backend được đóng cứng vào bản web lúc đóng gói, nên đổi backend thì phải deploy lại.
 * Bản web chạy https nên backend phải là https công khai (không dùng được http://192.168...).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const linkFile = path.join(root, '.vercel', 'project.json');
if (!fs.existsSync(linkFile)) {
  console.error('Chưa liên kết dự án Vercel. Chạy: npx vercel link --project zomzom');
  process.exit(1);
}
const { orgId, projectId } = JSON.parse(fs.readFileSync(linkFile, 'utf8'));

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const apiIdx = args.indexOf('--api');
let apiUrl = apiIdx >= 0 ? args[apiIdx + 1] : undefined;
if (apiIdx >= 0 && !apiUrl) {
  console.error('Thiếu địa chỉ sau --api (vd: --api https://abc.trycloudflare.com)');
  process.exit(1);
}
if (apiUrl) {
  apiUrl = apiUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(apiUrl)) {
    console.error('Địa chỉ backend phải bắt đầu bằng https:// (trang web chạy https không gọi được http).');
    process.exit(1);
  }
  // Cho phép đưa gốc máy chủ hoặc đủ đường dẫn /api/v1
  if (!/\/api\/v1$/.test(apiUrl)) apiUrl += '/api/v1';
}

const run = (cmd, cmdArgs, extraEnv = {}) => {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: true, cwd: root, env: { ...process.env, ...extraEnv } });
  if (res.status !== 0) process.exit(res.status ?? 1);
};

// 1) Đóng gói. Biến môi trường có sẵn được ưu tiên hơn file .env (Expo không ghi đè).
console.log(apiUrl ? `Đóng gói bản web, backend: ${apiUrl}` : 'Đóng gói bản web, backend theo mobile/.env');
run('npx', ['expo', 'export', '-p', 'web'], apiUrl ? { EXPO_PUBLIC_API_URL: apiUrl } : {});

/**
 * 2) Vercel luôn bỏ qua mọi thư mục tên "node_modules" khi tải lên, mà Expo lại để font biểu tượng (Ionicons...)
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

// 3) Tải lên Vercel
run('npx', ['vercel', 'deploy', 'dist', '--yes', ...(preview ? [] : ['--prod'])], {
  VERCEL_ORG_ID: orgId,
  VERCEL_PROJECT_ID: projectId,
});
console.log('\nXong! Mở: https://zomzom-puce.vercel.app');
