import { PrismaClient } from '@prisma/client';
import { cleanAndValidateAddress } from '../src/common/utils/address.util';

const prisma = new PrismaClient();

interface AuditRecord {
  id: string;
  userId: string;
  oldAddressLine: string;
  newAddressLine: string;
  reason: string;
  needsConfirmation: boolean;
  status: 'PLANNED' | 'APPLIED' | 'SKIPPED';
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`===========================================================`);
  console.log(`🔍 SCRIPT QUÉT VÀ XỬ LÝ ĐỊA CHỈ SAI ĐỊNH DẠNG TRONG DATABASE`);
  console.log(`Chế độ: ${isDryRun ? 'DRY RUN (Chạy thử nghiệm - KHÔNG ghi dữ liệu)' : 'LIVE (Ghi dữ liệu thật vào DB)'}`);
  console.log(`===========================================================\n`);

  const addresses = await prisma.address.findMany();
  console.log(`Tổng số bản ghi địa chỉ tìm thấy: ${addresses.length}`);

  const auditLog: AuditRecord[] = [];

  for (const addr of addresses) {
    const { cleanedAddress, needsConfirmation, isModified, reason } = cleanAndValidateAddress(
      addr.addressLine,
      addr.latitude,
      addr.longitude,
      addr.needsConfirmation,
    );

    if (isModified) {
      if (!isDryRun) {
        await prisma.address.update({
          where: { id: addr.id },
          data: {
            addressLine: cleanedAddress,
            needsConfirmation,
          },
        });
      }

      auditLog.push({
        id: addr.id,
        userId: addr.userId,
        oldAddressLine: addr.addressLine,
        newAddressLine: cleanedAddress,
        reason: reason || 'Cập nhật địa chỉ',
        needsConfirmation,
        status: isDryRun ? 'PLANNED' : 'APPLIED',
      });
    }
  }

  // Quét cả bảng đơn hàng (Order)
  const orders = await prisma.order.findMany();
  let fixedOrders = 0;
  for (const order of orders) {
    const { cleanedAddress, isModified } = cleanAndValidateAddress(
      order.deliveryAddress,
      order.deliveryLat,
      order.deliveryLng,
      false,
    );

    if (isModified && cleanedAddress !== order.deliveryAddress) {
      fixedOrders++;
      if (!isDryRun) {
        await prisma.order.update({
          where: { id: order.id },
          data: { deliveryAddress: cleanedAddress },
        });
      }
    }
  }

  console.log('\n================ BẢNG CHI TIẾT CÁC BẢN GHI ĐƯỢC XỬ LÝ ================');
  if (auditLog.length === 0) {
    console.log('✅ Cơ sở dữ liệu đã sạch! Không có bản ghi nào bị sai định dạng toạ độ hay lặp phường.');
  } else {
    console.table(
      auditLog.map((r) => ({
        ID: r.id.substring(0, 8) + '...',
        'Địa chỉ cũ': r.oldAddressLine,
        'Địa chỉ mới': r.newAddressLine,
        'Xác nhận lại?': r.needsConfirmation ? 'CÓ (True)' : 'KHÔNG',
        'Lý do': r.reason,
        'Trạng thái': r.status,
      })),
    );
  }
  console.log(`Tổng số địa chỉ xử lý: ${auditLog.length}`);
  console.log(`Tổng số đơn hàng xử lý: ${fixedOrders}`);
  console.log(`======================================================================\n`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi thực thi script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
