import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Nạp biến môi trường từ .env nếu chưa có
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim() || '';
const API_KEY = process.env.CLOUDINARY_API_KEY?.trim() || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim() || '';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

type ImageFolder = 'avatars' | 'restaurants' | 'dishes' | 'banners' | 'cuisines';

const FOLDER_MAX_WIDTH: Record<ImageFolder, number> = {
  banners: 1600,
  restaurants: 1200,
  dishes: 800,
  avatars: 400,
  cuisines: 400,
};

function isCloudinary(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('cloudinary.com/');
}

function isDataUri(url?: string | null): boolean {
  if (!url) return false;
  return url.trim().startsWith('data:image/');
}

// Băm SHA-1 cho chữ ký Cloudinary
function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(`${sorted}${secret}`).digest('hex');
}

// Cache URL đã upload để không tải trùng cùng một ảnh (theo hash nội dung hoặc đường dẫn)
const uploadCache = new Map<string, string>();

async function uploadToCloudinary(dataUri: string, folder: ImageFolder): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const cloudFolder = `zomzom/${folder}`;
  const signature = sign({ folder: cloudFolder, timestamp: String(timestamp) }, API_SECRET);

  const form = new FormData();
  form.append('file', dataUri);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', cloudFolder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  const width = FOLDER_MAX_WIDTH[folder] ?? 800;
  return String(data.secure_url).replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

function fileToDataUri(filePath: string): string | null {
  const cleanPath = filePath.replace(/^\/?public\/?/, '');
  const candidates = [
    filePath,
    path.join(process.cwd(), filePath.replace(/^\//, '')),
    path.join(process.cwd(), 'public', cleanPath),
    path.join(process.cwd(), 'backend', 'public', cleanPath),
    path.join(__dirname, '..', 'public', cleanPath),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const ext = path.extname(c).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      const buf = fs.readFileSync(c);
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  }
  return null;
}

interface TableStats {
  total: number;
  alreadyCloudinary: number;
  migrated: number;
  emptyOrSkipped: number;
  failed: number;
}

async function run() {
  const startTime = Date.now();
  console.log(`\n============================================================`);
  console.log(`🚀 BẮT ĐẦU CHUYỂN ẢNH SANG CLOUDINARY (Chế độ: ${isDryRun ? 'DRY-RUN (Thử nghiệm)' : 'REAL (Thật)'})`);
  console.log(`============================================================`);

  if (!isDryRun && (!CLOUD_NAME || !API_KEY || !API_SECRET)) {
    console.error('❌ Lỗi: Thiếu cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET.');
    process.exit(1);
  }

  const stats: Record<string, TableStats> = {
    users: { total: 0, alreadyCloudinary: 0, migrated: 0, emptyOrSkipped: 0, failed: 0 },
    restaurants: { total: 0, alreadyCloudinary: 0, migrated: 0, emptyOrSkipped: 0, failed: 0 },
    menuItems: { total: 0, alreadyCloudinary: 0, migrated: 0, emptyOrSkipped: 0, failed: 0 },
    banners: { total: 0, alreadyCloudinary: 0, migrated: 0, emptyOrSkipped: 0, failed: 0 },
    cuisines: { total: 0, alreadyCloudinary: 0, migrated: 0, emptyOrSkipped: 0, failed: 0 },
  };

  // Helper xử lý từng ảnh
  async function processImage(
    rawUrl: string | null | undefined,
    folder: ImageFolder,
    tableKey: string,
    updateFn: (newUrl: string) => Promise<void>,
  ) {
    const s = stats[tableKey];
    if (!rawUrl || !rawUrl.trim()) {
      s.emptyOrSkipped++;
      return;
    }

    const trimmed = rawUrl.trim();
    if (isCloudinary(trimmed)) {
      s.alreadyCloudinary++;
      return;
    }

    let cacheKey = '';
    let dataUriToUpload: string | null = null;

    if (isDataUri(trimmed)) {
      cacheKey = createHash('sha256').update(trimmed).digest('hex');
      dataUriToUpload = trimmed;
    } else {
      // Local path (ví dụ /public/images/food/pho.jpg hoặc public/uploads/...)
      cacheKey = trimmed;
      dataUriToUpload = fileToDataUri(trimmed);
      if (!dataUriToUpload) {
        // Nếu là URL http bên ngoài (không phải data URI và không có file local), giữ nguyên hoặc bỏ qua
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          s.emptyOrSkipped++;
          return;
        }
        console.warn(`[${tableKey}] Không tìm thấy file cục bộ: ${trimmed}`);
        s.failed++;
        return;
      }
    }

    if (isDryRun) {
      s.migrated++;
      return;
    }

    try {
      let finalUrl = uploadCache.get(cacheKey);
      if (!finalUrl) {
        finalUrl = await uploadToCloudinary(dataUriToUpload, folder);
        uploadCache.set(cacheKey, finalUrl);
      }
      await updateFn(finalUrl);
      s.migrated++;
    } catch (err: any) {
      console.error(`[${tableKey}] Lỗi tải ảnh lên Cloudinary:`, err?.message || err);
      s.failed++;
    }
  }

  // 1. Users (avatarUrl)
  console.log('1/5 Đang quét bảng Users (avatar)...');
  const users = await prisma.user.findMany({ select: { id: true, avatarUrl: true } });
  stats.users.total = users.length;
  for (const u of users) {
    await processImage(u.avatarUrl, 'avatars', 'users', async (url) => {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: url } });
    });
  }

  // 2. Restaurants (imageUrl)
  console.log('2/5 Đang quét bảng Restaurants (ảnh quán)...');
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, imageUrl: true } });
  stats.restaurants.total = restaurants.length;
  for (const r of restaurants) {
    await processImage(r.imageUrl, 'restaurants', 'restaurants', async (url) => {
      await prisma.restaurant.update({ where: { id: r.id }, data: { imageUrl: url } });
    });
  }

  // 3. MenuItems (imageUrl)
  console.log('3/5 Đang quét bảng MenuItems (món ăn)...');
  const items = await prisma.menuItem.findMany({ select: { id: true, imageUrl: true } });
  stats.menuItems.total = items.length;
  for (const item of items) {
    await processImage(item.imageUrl, 'dishes', 'menuItems', async (url) => {
      await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl: url } });
    });
  }

  // 4. Banners (imageUrl)
  console.log('4/5 Đang quét bảng Banners...');
  const banners = await prisma.banner.findMany({ select: { id: true, imageUrl: true } });
  stats.banners.total = banners.length;
  for (const b of banners) {
    await processImage(b.imageUrl, 'banners', 'banners', async (url) => {
      await prisma.banner.update({ where: { id: b.id }, data: { imageUrl: url } });
    });
  }

  // 5. CuisineCategory (imageUrl)
  console.log('5/5 Đang quét bảng CuisineCategory (danh mục ẩm thực)...');
  const cuisines = await prisma.cuisineCategory.findMany({ select: { id: true, imageUrl: true } });
  stats.cuisines.total = cuisines.length;
  for (const c of cuisines) {
    await processImage(c.imageUrl, 'cuisines', 'cuisines', async (url) => {
      await prisma.cuisineCategory.update({ where: { id: c.id }, data: { imageUrl: url } });
    });
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n============================================================`);
  console.log(`📊 BÁO CÁO TỔNG KẾT DI CHUYỂN ẢNH (${isDryRun ? 'DRY-RUN' : 'HOÀN TẤT'})`);
  console.log(`============================================================`);
  for (const [key, s] of Object.entries(stats)) {
    console.log(
      `- ${key.padEnd(14)}: Tổng ${s.total} | ${isDryRun ? 'Sẽ chuyển' : 'Đã chuyển'}: ${s.migrated} | Đã ở Cloudinary: ${s.alreadyCloudinary} | Bỏ qua/trống: ${s.emptyOrSkipped} | Thất bại: ${s.failed}`,
    );
  }
  console.log(`------------------------------------------------------------`);
  console.log(`Tổng số ảnh upload duy nhất lên Cloudinary: ${uploadCache.size}`);
  console.log(`Thời gian thực thi: ${durationSec} giây.`);
  console.log(`============================================================\n`);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error('Fatal error during migration:', e);
  prisma.$disconnect();
  process.exit(1);
});
