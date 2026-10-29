import * as fs from 'fs';
import * as path from 'path';

const targetDir = path.join(process.cwd(), 'public', 'images', 'food');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function generateFoodSvg(title: string, subtitle: string, bgColor: string, icon: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="${bgColor}"/>
  <circle cx="300" cy="180" r="100" fill="rgba(255,255,255,0.2)"/>
  <text x="300" y="195" font-size="72" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${icon}</text>
  <text x="300" y="315" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${title}</text>
  <text x="300" y="350" font-size="16" fill="rgba(255,255,255,0.85)" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${subtitle}</text>
</svg>`;
}

const assets = [
  { file: 'pho.svg', title: 'Phở Bò Gia Truyền', subtitle: 'Nước dùng đậm đà 24h', bg: '#8B4513', icon: '🍜' },
  { file: 'comtam.svg', title: 'Cơm Tấm Sài Gòn', subtitle: 'Sườn nướng than hoa mật ong', bg: '#D2691E', icon: '🍚' },
  { file: 'bunbo.svg', title: 'Bún Bò Huế Cố Đô', subtitle: 'Sa tế cay nồng thơm lừng', bg: '#B22222', icon: '🍲' },
  { file: 'banhmi.svg', title: 'Bánh Mì Giòn Rụm', subtitle: 'Pate xíu mại đậm vị', bg: '#CD853F', icon: '🥖' },
  { file: 'trasua.svg', title: 'Trà Sữa Trân Châu', subtitle: 'Trà nguyên lá sữa tươi', bg: '#9370DB', icon: '🧋' },
  { file: 'garan.svg', title: 'Gà Rán Giòn Cay', subtitle: 'Lắc phô mai hảo hạng', bg: '#E65100', icon: '🍗' },
  { file: 'hutieu.svg', title: 'Hủ Tiếu Nam Vang', subtitle: 'Tôm mực tươi rói khô & nước', bg: '#008B8B', icon: '🥣' },
  { file: 'caphe.svg', title: 'Cà Phê Muối Cố Đô', subtitle: 'Kem muối béo ngậy cà phê đậm', bg: '#4A2C2A', icon: '☕' },
  { file: 'micay.svg', title: 'Mì Cay Hàn Quốc', subtitle: '7 cấp độ thách thức vị giác', bg: '#C62828', icon: '🥘' },
  { file: 'buncha.svg', title: 'Bún Chả Hà Nội', subtitle: 'Chả nướng than thơm phức', bg: '#2E7D32', icon: '🥗' },
  { file: 'che.svg', title: 'Chè Bưởi & Tráng Miệng', subtitle: 'Đậu xanh nước cốt dừa béo', bg: '#F57F17', icon: '🍧' },
  { file: 'banhcuon.svg', title: 'Bánh Cuốn Nóng', subtitle: 'Hành phi giòn rụm chả quế', bg: '#5D4037', icon: '🥞' },
  { file: 'comga.svg', title: 'Cơm Gà Xối Mỡ', subtitle: 'Đùi góc tư da giòn rụm', bg: '#EF6C00', icon: '🍗' },
  { file: 'traicay.svg', title: 'Trà Trái Cây Nhiệt Đới', subtitle: 'Ổi hồng thanh long tươi mát', bg: '#D81B60', icon: '🍹' },
  { file: 'lau.svg', title: 'Lẩu & Nướng Tự Chọn', subtitle: 'Bò Mỹ tươi ngon nước lẩu thái', bg: '#AD1457', icon: '🍲' },
  { file: 'pizza.svg', title: 'Pizza Ý Lò Củi', subtitle: 'Đế mỏng phô mai Mozzarella', bg: '#C0392B', icon: '🍕' },
  { file: 'default.svg', title: 'Món Ngon Đặc Sản', subtitle: 'Thơm ngon chuẩn vị', bg: '#455A64', icon: '🍽️' },
];

for (const a of assets) {
  const filePath = path.join(targetDir, a.file);
  fs.writeFileSync(filePath, generateFoodSvg(a.title, a.subtitle, a.bg, a.icon), 'utf-8');
}

console.log(`Đã tạo thành công ${assets.length} tệp hình ảnh SVG cục bộ tại: ${targetDir}`);

