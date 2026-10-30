/**
 * Đổi đường dẫn ảnh giữ chỗ .svg sang ảnh chụp .jpg cùng tên trong public/images/food.
 * Lý do: React Native Image trên điện thoại không hiển thị được SVG.
 * - Chỉ sửa cột imageUrl của restaurants, menu_items, banners.
 * - Chỉ đổi khi file .jpg tương ứng tồn tại.
 * - Chạy lại nhiều lần không thay đổi thêm gì.
 * Đảo ngược: chạy với tham số --revert.
 *
 * Chạy: npx ts-node scripts/fix-image-extensions.ts [--revert]
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const revert = process.argv.includes('--revert');
const [from, to] = revert ? ['.jpg', '.svg'] : ['.svg', '.jpg'];
const PREFIX = '/public/images/food/';

function mapUrl(url: string | null): string | null {
  if (!url || !url.startsWith(PREFIX) || !url.endsWith(from)) return null;
  const next = url.slice(0, -from.length) + to;
  return existsSync(join(process.cwd(), next.replace(/^\//, ''))) ? next : null;
}

async function main() {
  const counts: Record<string, number> = {};

  for (const r of await prisma.restaurant.findMany({ select: { id: true, imageUrl: true } })) {
    const next = mapUrl(r.imageUrl);
    if (next) {
      await prisma.restaurant.update({ where: { id: r.id }, data: { imageUrl: next } });
      counts.restaurants = (counts.restaurants ?? 0) + 1;
    }
  }
  for (const m of await prisma.menuItem.findMany({ select: { id: true, imageUrl: true } })) {
    const next = mapUrl(m.imageUrl);
    if (next) {
      await prisma.menuItem.update({ where: { id: m.id }, data: { imageUrl: next } });
      counts.menuItems = (counts.menuItems ?? 0) + 1;
    }
  }
  for (const b of await prisma.banner.findMany({ select: { id: true, imageUrl: true } })) {
    const next = mapUrl(b.imageUrl);
    if (next) {
      await prisma.banner.update({ where: { id: b.id }, data: { imageUrl: next } });
      counts.banners = (counts.banners ?? 0) + 1;
    }
  }

  console.log(`Đã đổi ${from} → ${to}:`, Object.keys(counts).length ? counts : 'không có bản ghi nào cần đổi');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
