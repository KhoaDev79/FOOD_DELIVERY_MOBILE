# Hướng dẫn deploy ZomZom (miễn phí)

Tài liệu này dành cho người tự đưa backend lên Internet và build file APK để cài trên điện thoại thật.
Có 2 cách deploy backend, chọn **một**:

| | A. Render + Neon | B. Oracle Cloud Always Free |
|---|---|---|
| Độ khó | Dễ, không cần quản lý máy chủ | Trung bình, tự quản lý máy ảo Linux |
| Chi phí | 0 đ | 0 đ (cần thẻ để xác minh, không bị trừ tiền) |
| Máy chủ ngủ? | **Có**: ngủ sau ~15 phút không có truy cập | Không, chạy 24/7 |
| Phù hợp | Demo, chấm bài | Chạy thử thật nhiều ngày |

> Backend đã tự chạy `prisma migrate deploy` mỗi lần container khởi động ([docker-entrypoint.sh](../backend/docker-entrypoint.sh)),
> nên không cần chạy migration bằng tay. Đặt `RUN_MIGRATIONS=false` nếu muốn tắt.

---

## 0. Chuẩn bị chung

1. **Khoá bí mật mới** cho production (không dùng giá trị `change_me…` trong `.env.example`). Chạy 3 lần lệnh sau, mỗi lần lấy một chuỗi:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Dùng cho `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QUOTE_SECRET`. Nếu quên, backend vẫn chạy nhưng log in dòng `[CẢNH BÁO BẢO MẬT]`.
2. **Cloudinary** (bắt buộc với cách A, nên có với cách B): máy chủ miễn phí không giữ file ghi ra đĩa khi build lại, ảnh phải nằm trên Cloudinary.
   Lấy `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` tại https://console.cloudinary.com.
3. Danh sách biến đầy đủ và biến nào bắt buộc: xem phần đầu [backend/.env.example](../backend/.env.example).

---

## A. Render (backend) + Neon (cơ sở dữ liệu)

### A1. Tạo cơ sở dữ liệu trên Neon
1. Đăng ký https://neon.tech → **Create project** (region Singapore cho gần Việt Nam).
2. Ở mục **Connection details**, tắt "Pooled connection" rồi copy chuỗi kết nối, dạng:
   ```
   postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Dùng kết nối **trực tiếp** (không có chữ `-pooler`) vì `prisma migrate deploy` không chạy qua pooler.

### A2. Tạo Web Service trên Render
1. Đăng ký https://render.com, kết nối GitHub và chọn repo.
2. **New → Web Service**:
   - Root Directory: `backend`
   - Runtime: **Docker** (Render tự dùng `backend/Dockerfile`)
   - Instance type: **Free**
3. Tab **Environment**: thêm các biến:
   ```
   NODE_ENV=production
   DATABASE_URL=<chuỗi Neon ở bước A1>
   JWT_ACCESS_SECRET=<chuỗi ngẫu nhiên 1>
   JWT_REFRESH_SECRET=<chuỗi ngẫu nhiên 2>
   QUOTE_SECRET=<chuỗi ngẫu nhiên 3>
   CORS_ORIGINS=*
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   VNPAY_RETURN_URL=https://<ten-service>.onrender.com/api/v1/payments/vnpay/return
   ```
   Các biến nghiệp vụ khác (phí ship, hạn mức nợ…) có giá trị mặc định, chỉ thêm khi muốn đổi.
4. **Create Web Service**. Khi log hiện `No pending migrations` / `All migrations have been successfully applied` và `Nest application successfully started` là xong.
5. Kiểm tra: mở `https://<ten-service>.onrender.com/api/v1/config/public`, thấy JSON là chạy.

### A3. Dữ liệu mẫu (tuỳ chọn)
Chạy seed từ máy mình, trỏ vào Neon:
```bash
cd backend
DATABASE_URL="<chuỗi Neon>" npx prisma db seed
```
(PowerShell: `$env:DATABASE_URL="<chuỗi Neon>"; npx prisma db seed`)

### A4. Lưu ý quan trọng của gói Free
- **Máy chủ ngủ** sau ~15 phút không có truy cập; lần gọi đầu tiên mất 30–60 giây để thức dậy.
- Khi ngủ, **cron không chạy**: đơn không tự huỷ khi quán không nhận, không phát hiện đơn ứ đọng. Socket realtime cũng ngắt.
- Muốn giữ thức khi demo: dùng https://uptimerobot.com (miễn phí) ping `.../api/v1/config/public` mỗi 5 phút. Gói Free có 750 giờ/tháng, đủ cho 1 service chạy liên tục.
- Đĩa không lưu lâu dài → ảnh bắt buộc qua Cloudinary.

---

## B. Oracle Cloud Always Free + Docker Compose + DuckDNS + Caddy

### B1. Tạo máy ảo
1. Đăng ký https://www.oracle.com/cloud/free (cần thẻ để xác minh).
2. **Create VM instance**: image **Ubuntu 22.04**, shape **Ampere (VM.Standard.A1.Flex)** 2 OCPU / 12 GB RAM (vẫn trong hạn mức free). Tải khoá SSH về.
3. Mở cổng: **Networking → VCN → Security List → Add Ingress Rules** cho TCP **80** và **443** (nguồn `0.0.0.0/0`).
4. SSH vào máy và mở tường lửa của Ubuntu:
   ```bash
   ssh -i khoa.key ubuntu@<IP>
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

### B2. Cài Docker và lấy mã nguồn
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
git clone <link-repo> zomzom && cd zomzom
cp backend/.env.example backend/.env
nano backend/.env   # điền khoá ngẫu nhiên, Cloudinary, NODE_ENV=production…
```

### B3. Tên miền miễn phí DuckDNS
1. Vào https://www.duckdns.org, đăng nhập, tạo subdomain (vd `zomzom`) trỏ về IP máy ảo.
2. Tự cập nhật IP mỗi 5 phút:
   ```bash
   (crontab -l 2>/dev/null; echo "*/5 * * * * curl -s 'https://www.duckdns.org/update?domains=zomzom&token=<TOKEN>&ip=' >/dev/null") | crontab -
   ```

### B4. Đổi mật khẩu DB và không mở cổng Postgres ra ngoài
`docker-compose.yml` trong repo dùng cho máy dev (mật khẩu `food_secret`, mở cổng 5433). Trên máy chủ, tạo file `docker-compose.prod.yml` để ghi đè:
```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: <mat-khau-db-manh>
    ports: !reset []          # không mở 5433 ra Internet
  backend:
    environment:
      DATABASE_URL: postgresql://food:<mat-khau-db-manh>@postgres:5432/food_delivery?schema=public
    ports: !reset []          # chỉ Caddy gọi vào backend
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [backend]
volumes:
  caddy_data:
```
> Mật khẩu Postgres chỉ có tác dụng ở **lần tạo volume đầu tiên**. Đặt trước khi chạy lần đầu.

### B5. Caddy: HTTPS tự động
Tạo file `Caddyfile` ở thư mục gốc repo:
```
zomzom.duckdns.org {
    reverse_proxy backend:3000
}
```
Caddy tự xin chứng chỉ HTTPS (Let's Encrypt) và hỗ trợ WebSocket cho realtime.

> Thêm `TRUST_PROXY=1` vào `backend/.env`. Không có dòng này, backend thấy mọi yêu cầu đến từ IP của Caddy, nên
> giới hạn theo IP (đăng nhập sai, đăng ký) sẽ dồn chung cho tất cả người dùng. Trên Render cũng đặt `TRUST_PROXY=1`.

### B6. Chạy
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f backend    # đợi thấy "Nest application successfully started"
```
Kiểm tra: `https://zomzom.duckdns.org/api/v1/config/public`.

Cập nhật phiên bản mới: `git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend` (migration tự chạy).

Sao lưu DB định kỳ:
```bash
docker exec food_delivery_db pg_dump -U food -Fc food_delivery > backup_$(date +%F).dump
```

Nhớ đặt trong `backend/.env`:
```
VNPAY_RETURN_URL=https://zomzom.duckdns.org/api/v1/payments/vnpay/return
CORS_ORIGINS=https://zomzom.duckdns.org
```

---

## C. Build APK Android bằng EAS (miễn phí)

1. Cài công cụ và đăng nhập (tài khoản https://expo.dev miễn phí):
   ```bash
   npm install -g eas-cli
   cd mobile
   eas login
   ```
2. Trỏ app tới backend đã deploy: trong [mobile/eas.json](../mobile/eas.json), thêm `env` cho profile `preview`:
   ```json
   "preview": {
     "distribution": "internal",
     "env": { "EXPO_PUBLIC_API_URL": "https://zomzom.duckdns.org/api/v1" },
     "android": { "buildType": "apk" }
   }
   ```
   (Cách A thì dùng `https://<ten-service>.onrender.com/api/v1`.) Phải là **https** và có đuôi `/api/v1`.
3. Build:
   ```bash
   eas build -p android --profile preview
   ```
   Lần đầu EAS hỏi tạo keystore: chọn **Yes** để EAS tự quản lý. Build chạy trên máy chủ Expo (gói free có xếp hàng, thường 10–30 phút).
4. Xong sẽ có link tải `.apk`. Mở link trên điện thoại Android, cho phép "Cài ứng dụng không rõ nguồn" rồi cài.

Ghi chú:
- Profile `production` tạo file `.aab` để đưa lên Google Play (cần tài khoản nhà phát triển 25 USD), không cần cho demo.
- Đổi địa chỉ backend thì phải build lại APK, vì `EXPO_PUBLIC_API_URL` được đóng gói lúc build.
- Thông báo đẩy (Expo push) hoạt động trên APK; trên Expo Go chỉ hoạt động hạn chế.

---

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Log `Missing required environment variables` | Thiếu `DATABASE_URL` hoặc 3 khoá bí mật. |
| Log `must be at least 32 characters` | Khoá bí mật quá ngắn, tạo lại bằng lệnh ở mục 0. |
| `migrate deploy` lỗi `P1001` | Không kết nối được DB: sai `DATABASE_URL`, Neon thiếu `?sslmode=require`, hoặc dùng chuỗi `-pooler`. |
| `./docker-entrypoint.sh: not found` | File bị đổi sang xuống dòng CRLF. Dockerfile đã tự sửa; nếu vẫn lỗi, chạy `git add --renormalize .` |
| App báo "Network Error" | APK build với `EXPO_PUBLIC_API_URL` sai, hoặc máy chủ Render đang ngủ (đợi ~1 phút rồi thử lại). |
| Thanh toán VNPay quay về trang lỗi | `VNPAY_RETURN_URL` vẫn là `localhost`. |
| Ảnh mất sau khi deploy lại | Chưa cấu hình Cloudinary, ảnh đang ghi ra đĩa của container. |

## D. Bản web (frontend) trên Vercel
Dự án Vercel: **zomzom** – địa chỉ chính `https://zomzom-puce.vercel.app` (tài khoản `minhkhoatrannam-2442`).

1. Đăng nhập một lần (PowerShell): `cd mobile; npx vercel login`.
2. Đặt `EXPO_PUBLIC_API_URL` trong `mobile/.env` thành địa chỉ **https công khai** của backend (vd `https://api-zomzom.onrender.com/api/v1`).
   Biến này được đóng vào bản web lúc build; trang https không gọi được backend `http://192.168...` của máy dev.
3. Deploy: `cd mobile; npm run deploy:web` (đóng gói + tải lên bản chính). Thêm `-- --preview` để tạo bản xem thử.
   Dùng backend khác mà không sửa `.env`: `npm run deploy:web -- --api https://abc.trycloudflare.com`.

**Tạm thời dùng Docker trên máy làm backend (Cloudflare Tunnel, miễn phí, không cần tài khoản):**
1. Cửa sổ PowerShell riêng, để mở suốt lúc dùng: `cloudflared tunnel --url http://localhost:3000`
   → copy link `https://<tên-ngẫu-nhiên>.trycloudflare.com` hiện trong khung.
2. `cd mobile; npm run deploy:web -- --api https://<tên-ngẫu-nhiên>.trycloudflare.com`
3. Tắt cửa sổ đường hầm là web mất kết nối; mở lại sẽ ra link MỚI → chạy lại bước 2.
   Lưu ý: ai có link đường hầm đều gọi được API trên máy bạn (kể cả đăng nhập tài khoản mẫu `Password123!`),
   nên chỉ mở khi đang thử.
4. Backend: thêm `https://zomzom-puce.vercel.app` vào `CORS_ORIGINS`.
5. Google Cloud (Web Client ID): thêm `https://zomzom-puce.vercel.app` vào *Authorized JavaScript origins* và *Authorized redirect URIs*.

Ghi chú kỹ thuật:
- `mobile/public/` chứa `index.html` (thẻ cho iPhone "Thêm vào Màn hình chính"), `manifest.json`, biểu tượng và `vercel.json` (mọi đường dẫn trả về `index.html`).
- Vercel bỏ qua thư mục tên `node_modules` khi tải lên, nên `scripts/deploy-web.js` đổi `dist/assets/node_modules` → `dist/assets/vendor`, và `vercel.json` chuyển đường dẫn `/assets/node_modules/*` sang `/assets/vendor/*` (nếu không, biểu tượng thành ô vuông). Không sửa nội dung file JS: tên file có mã hash và được trình duyệt lưu lâu.
