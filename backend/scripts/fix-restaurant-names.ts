/**
 * Bỏ nhãn kiểm thử "[Biên: ...]" và ghi chú kỹ thuật khỏi tên/mô tả quán và món mẫu.
 * Đặc điểm dùng để kiểm thử (đóng cửa, ngoài bán kính, tên dài, không ảnh) vẫn giữ nguyên trong dữ liệu.
 * Chạy lại nhiều lần không thay đổi thêm gì.
 *
 * Chạy: npx ts-node scripts/fix-restaurant-names.ts
 */
import { PrismaClient } from '@prisma/client';

export const RESTAURANT_RENAMES: { from: string; name: string; description: string }[] = [
  {
    from: 'Bánh Cuốn Nóng Tây Hồ [Biên: Đang đóng cửa]',
    name: 'Bánh Cuốn Nóng Tây Hồ',
    description: 'Bánh cuốn tráng tay nóng hổi, chả quế lá chuối',
  },
  {
    from: 'Hải Sản Tươi Sống Cần Giờ [Biên: Ngoài bán kính phục vụ]',
    name: 'Hải Sản Tươi Sống Cần Giờ',
    description: 'Cua biển, tôm hùm tươi sống vùng duyên hải Cần Giờ',
  },
  {
    from: 'Lẩu & Nướng Tự Chọn Phố Đêm [Biên: Thực đơn >20 món]',
    name: 'Lẩu & Nướng Tự Chọn Phố Đêm',
    description: 'Buffet nướng lẩu tự chọn với hơn 20 món đa dạng giá rẻ',
  },
  {
    from: 'Quán Ẩm Thực Cố Đô Chuyên Các Món Bún Bò Xứ Huế Truyền Thống Nổi Tiếng Đậm Đà Xứ Thần Kinh [Biên: Tên dài & Không ảnh]',
    name: 'Quán Ẩm Thực Cố Đô - Bún Bò Xứ Huế Truyền Thống',
    description: 'Quán gia truyền phục vụ bún bò lâu năm',
  },
];

/** Món mẫu: bỏ nhãn kiểm thử khỏi tên. Trạng thái "tạm hết" vẫn nằm ở cột isAvailable. */
export const MENU_ITEM_RENAMES: { from: string[]; name: string; description: string }[] = [
  {
    from: ['Phở Gầu Giòn Hết Hàng [Biên: Hết món]', 'Phở Gầu Giòn Hết Hàng'],
    name: 'Phở Gầu Giòn',
    description: 'Gầu bò giòn sần sật, nước dùng ninh xương đậm đà',
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    let changed = 0;
    for (const r of RESTAURANT_RENAMES) {
      const res = await prisma.restaurant.updateMany({
        where: { name: r.from },
        data: { name: r.name, description: r.description },
      });
      changed += res.count;
    }
    let changedItems = 0;
    for (const m of MENU_ITEM_RENAMES) {
      const res = await prisma.menuItem.updateMany({
        where: { name: { in: m.from } },
        data: { name: m.name, description: m.description },
      });
      changedItems += res.count;
    }
    console.log(
      changed || changedItems
        ? `Đã đổi tên ${changed} quán, ${changedItems} món.`
        : 'Không có quán hay món nào cần đổi tên.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
