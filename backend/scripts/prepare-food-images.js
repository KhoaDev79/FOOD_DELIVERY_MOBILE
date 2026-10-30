const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const targetDir = path.join(__dirname, '..', 'public', 'images', 'food');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Danh sách ảnh từ Unsplash (giấy phép Unsplash License - miễn phí thương mại và phi thương mại, không bắt buộc ghi nguồn)
const FOODS = [
  { key: 'pho', name: 'Phở Bò', url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&q=80', color: [220, 38, 38] },
  { key: 'comtam', name: 'Cơm Tấm', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', color: [234, 88, 12] },
  { key: 'banhmi', name: 'Bánh Mì', url: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=800&q=80', color: [217, 119, 6] },
  { key: 'bunbo', name: 'Bún Bò', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80', color: [185, 28, 28] },
  { key: 'buncha', name: 'Bún Chả', url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80', color: [202, 138, 4] },
  { key: 'banhcuon', name: 'Bánh Cuốn', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80', color: [13, 148, 136] },
  { key: 'hutieu', name: 'Hủ Tiếu', url: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&q=80', color: [234, 88, 12] },
  { key: 'comga', name: 'Cơm Gà', url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80', color: [202, 138, 4] },
  { key: 'micay', name: 'Mì Cay', url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80', color: [220, 38, 38] },
  { key: 'garan', name: 'Gà Rán', url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', color: [217, 119, 6] },
  { key: 'pizza', name: 'Pizza', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', color: [225, 29, 72] },
  { key: 'lau', name: 'Lẩu Thái', url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80', color: [194, 65, 12] },
  { key: 'trasua', name: 'Trà Sữa', url: 'https://images.unsplash.com/photo-1745883949374-baeba0ed57c3?w=800&q=80', color: [147, 51, 234] },
  { key: 'caphe', name: 'Cà Phê', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80', color: [120, 53, 15] },
  { key: 'che', name: 'Chè Khúc Bạch', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', color: [16, 185, 129] },
  { key: 'traicay', name: 'Trái Cây', url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&q=80', color: [236, 72, 153] },
  { key: 'default', name: 'Món Ăn', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', color: [238, 77, 45] },
];

// Helper tính CRC32 cho PNG
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Tạo file PNG chuẩn (800x500) với gradient màu và chữ ký PNG
function generateSolidPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit
  ihdrData[9] = 2; // RGB (không cần alpha)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makePngChunk('IHDR', ihdrData);

  // Tạo scanlines: mỗi dòng bắt đầu bằng filter byte 0, sau đó là 3 byte R,G,B cho mỗi pixel
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    const factor = 0.8 + 0.4 * (y / height); // Nhẹ gradient dọc
    const curR = Math.min(255, Math.floor(r * factor));
    const curG = Math.min(255, Math.floor(g * factor));
    const curB = Math.min(255, Math.floor(b * factor));
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      rawData[pxOffset] = curR;
      rawData[pxOffset + 1] = curG;
      rawData[pxOffset + 2] = curB;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = makePngChunk('IDAT', compressed);
  const iend = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    });
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('🔄 Đang chuẩn bị ảnh món ăn cục bộ chất lượng cao (PNG & JPEG 800px)...');
  let downloadedCount = 0;
  let generatedCount = 0;

  for (const item of FOODS) {
    const jpgDest = path.join(targetDir, `${item.key}.jpg`);
    const pngDest = path.join(targetDir, `${item.key}.png`);

    // 1. Tạo PNG chất lượng cao (800x500) đảm bảo 100% offline không bao giờ lỗi
    const pngBuffer = generateSolidPng(800, 500, item.color[0], item.color[1], item.color[2]);
    fs.writeFileSync(pngDest, pngBuffer);
    generatedCount++;

    // 2. Thử tải ảnh thật JPG từ Unsplash
    try {
      await downloadImage(item.url, jpgDest);
      downloadedCount++;
      console.log(`  ✓ Đã tải ảnh thật: ${item.key}.jpg (800px)`);
    } catch {
      // Nếu offline, copy file PNG làm fallback JPG để luôn có ảnh hợp lệ
      fs.copyFileSync(pngDest, jpgDest);
      console.log(`  ⚡ Chế độ offline: đã tạo ảnh cục bộ ${item.key}.jpg (${item.name})`);
    }
  }

  // Tạo tài liệu ghi rõ nguồn và giấy phép
  const sourcesMd = `# NGUỒN VÀ GIẤY PHÉP ẢNH MÓN ĂN DỰ ÁN

Tất cả ảnh món ăn được lưu cục bộ trong \`backend/public/images/food/\` và phục vụ qua NestJS static assets:

- **Định dạng**: JPEG / PNG (chiều rộng 800px, dung lượng tối ưu).
- **Nguồn cấp**: Unsplash Photos & Ảnh tạo cục bộ bằng Node.js.
- **Giấy phép**: [Unsplash License](https://unsplash.com/license)
  - Miễn phí cho mục đích thương mại và phi thương mại.
  - Không bắt buộc ghi công (nhưng được khuyến khích).
  - An toàn 100% khi chạy demo không cần kết nối Internet.

## Danh sách 17 món ăn cục bộ:
${FOODS.map((f) => `- **${f.key}** (${f.name}): \`/public/images/food/${f.key}.jpg\` (dự phòng: \`/public/images/food/${f.key}.png\`)`).join('\n')}
`;
  fs.writeFileSync(path.join(targetDir, 'SOURCES.md'), sourcesMd, 'utf8');

  console.log(`✅ Đã chuẩn bị xong toàn bộ ${FOODS.length} ảnh món ăn cục bộ.`);
  console.log(`   - Tải về từ mạng: ${downloadedCount}`);
  console.log(`   - Tạo ảnh cục bộ: ${generatedCount}`);
}

main().catch(console.error);

