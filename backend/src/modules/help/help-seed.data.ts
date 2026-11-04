import { HelpAudience } from '@prisma/client';

export interface SeedHelpCategory {
  code: string;
  name: string;
  icon: string;
  sortOrder: number;
  audience: HelpAudience;
}

export interface SeedHelpArticle {
  categoryCode: string;
  title: string;
  keywords: string[];
  sortOrder: number;
  body: string;
}

export const SEED_HELP_CATEGORIES: SeedHelpCategory[] = [
  {
    code: 'order_delivery',
    name: 'Đơn hàng & Giao nhận',
    icon: 'bicycle-outline',
    sortOrder: 1,
    audience: HelpAudience.CUSTOMER,
  },
  {
    code: 'payment_refund',
    name: 'Thanh toán & Tiền mặt',
    icon: 'wallet-outline',
    sortOrder: 2,
    audience: HelpAudience.CUSTOMER,
  },
  {
    code: 'issues_complaints',
    name: 'Sự cố & Khiếu nại',
    icon: 'alert-circle-outline',
    sortOrder: 3,
    audience: HelpAudience.CUSTOMER,
  },
  {
    code: 'account_partner',
    name: 'Tài khoản & Đăng ký đối tác',
    icon: 'person-circle-outline',
    sortOrder: 4,
    audience: HelpAudience.CUSTOMER,
  },
];

export const SEED_HELP_ARTICLES: SeedHelpArticle[] = [
  // Category 1: Đơn hàng & Giao nhận
  {
    categoryCode: 'order_delivery',
    title: 'Cách tính phí giao hàng (phí ship) tại ZomZom',
    keywords: ['phí ship', 'cước phí', 'giá giao hàng', 'cao điểm', 'bao nhiêu tiền'],
    sortOrder: 1,
    body: `### Công thức tính phí giao hàng
Phí giao hàng trên hệ thống ZomZom được tính toán tự động dựa trên khoảng cách thực tế giữa nhà hàng và địa chỉ giao hàng của bạn:

- **Cước phí cơ bản:** **15.000 ₫** cho **2 km đầu tiên**.
- **Cước mỗi km tiếp theo:** **5.000 ₫ / km**.
- **Phụ phí giờ cao điểm (+20%):** Áp dụng vào 2 khung giờ tập trung nhiều đơn trong ngày:
  - Buổi trưa: **11:00 – 13:00**
  - Buổi tối: **17:30 – 19:30**

*Lưu ý:* Phí ship ước tính chính xác sẽ hiển thị rõ ràng tại màn hình **Thanh toán (Checkout)** trước khi bạn bấm đặt đơn. Báo giá có hiệu lực trong 10 phút.`,
  },
  {
    categoryCode: 'order_delivery',
    title: 'Thời gian giao hàng dự kiến được tính thế nào?',
    keywords: ['thời gian giao', 'bao lâu nhận được', 'mấy phút', 'khi nào tới'],
    sortOrder: 2,
    body: `### Cách tính thời gian giao hàng
Thời gian giao hàng hiển thị trên ứng dụng được tổng hợp từ 3 yếu tố:

1. **Thời gian quán chuẩn bị món:** Trung bình từ 10 – 15 phút tuỳ số lượng món và giờ cao điểm.
2. **Thời gian tài xế di chuyển:** Tính toán theo khoảng cách đường bộ với tốc độ trung bình 20 – 25 km/h trong nội thành.
3. **Thời gian lấy và bàn giao món:** Khoảng 3 – 5 phút để tài xế kiểm tra món và gửi cho bạn.

Bạn có thể theo dõi vị trí trực tiếp của tài xế trên bản đồ ở màn hình **Theo dõi đơn hàng**.`,
  },
  {
    categoryCode: 'order_delivery',
    title: 'Khi nào tôi có thể tự huỷ đơn hàng?',
    keywords: ['huỷ đơn', 'đổi ý', 'không muốn mua', 'cancel order'],
    sortOrder: 3,
    body: `### Chính sách huỷ đơn hàng
- **Huỷ miễn phí:** Bạn có thể tự bấm nút **"Huỷ đơn"** bất cứ lúc nào khi đơn hàng đang ở trạng thái **Chờ xác nhận (PENDING)** mà không mất bất kỳ chi phí nào.
- **Sau khi quán đã xác nhận:** Khi quán đã bắt đầu làm món (**CONFIRMED** hoặc **PREPARING**), quán đã chuẩn bị nguyên liệu nên bạn không thể tự huỷ đơn trên app. Nếu có trường hợp khẩn cấp, vui lòng dùng tính năng **Báo vấn đề với đơn** hoặc liên hệ quán qua mục Chat.`,
  },
  {
    categoryCode: 'order_delivery',
    title: 'Tôi có thể đổi địa chỉ giao hàng sau khi đã đặt đơn không?',
    keywords: ['đổi địa chỉ', 'nhầm địa chỉ', 'giao chỗ khác'],
    sortOrder: 4,
    body: `### Đổi địa chỉ giao hàng
Sau khi đơn hàng đã được tạo, bạn **không thể tự sửa địa chỉ** trên hệ thống vì phí giao hàng và tài xế được chỉ định dựa trên toạ độ ban đầu.

**Cách xử lý:**
- Nếu đơn vẫn đang ở trạng thái **PENDING**, bạn có thể bấm **Huỷ đơn** ngay và đặt lại với địa chỉ chính xác.
- Nếu đơn đã có tài xế nhận, vui lòng mở mục **Chat với tài xế** để nhắn toạ độ/địa chỉ mới. Nếu khoảng cách chênh lệch xa, bạn có thể gửi thêm tiền tip xăng xe hỗ trợ tài xế.`,
  },
  {
    categoryCode: 'order_delivery',
    title: 'Quy trình nhận món an toàn và kiểm tra đơn hàng',
    keywords: ['nhận hàng', 'kiểm tra món', 'an toàn', 'đồng kiểm'],
    sortOrder: 5,
    body: `### Khi tài xế giao món đến:
1. **Kiểm tra thông tin:** Đối chiếu mã đơn hàng (VD: \`#AB12C3\`) và tên khách hàng in trên hoá đơn hoặc trên túi đựng.
2. **Kiểm tra ngoại quan:** Đảm bảo bao bì nguyên vẹn, túi đựng không bị rách, món ăn còn ấm/nóng và không bị đổ ra ngoài.
3. **Giữ lại hoá đơn:** Nên chụp ảnh hoá đơn và bao bì nếu có bất kỳ dấu hiệu sai lệch nào để dễ dàng gửi yêu cầu hỗ trợ.`,
  },

  // Category 2: Thanh toán & Tiền mặt
  {
    categoryCode: 'payment_refund',
    title: 'Thanh toán tiền mặt khi nhận hàng (COD) cần lưu ý gì?',
    keywords: ['tiền mặt', 'cod', 'trả tiền', 'thanh toán khi nhận'],
    sortOrder: 1,
    body: `### Thanh toán tiền mặt (COD)
- Bạn chỉ thanh toán **đúng số tiền Tổng cộng** hiển thị trong ứng dụng ZomZom.
- Tài xế không được thu thêm bất kỳ khoản phụ phí nào ngoài số tiền trên đơn.
- Để việc giao nhận diễn ra nhanh chóng, bạn nên chuẩn bị sẵn tiền lẻ hoặc tiền gần sát với giá trị đơn hàng.`,
  },
  {
    categoryCode: 'payment_refund',
    title: 'Thanh toán trực tuyến qua cổng VNPay',
    keywords: ['vnpay', 'thanh toán online', 'thẻ', 'qr code'],
    sortOrder: 2,
    body: `### Hướng dẫn thanh toán VNPay
- ZomZom hỗ trợ thanh toán qua cổng **VNPay Sandbox** (môi trường thử nghiệm).
- Bạn có thể quét mã QR qua ứng dụng ngân hàng hoặc nhập thông tin thẻ ATM nội địa.
- Đơn hàng thanh toán VNPay chỉ được gửi đến quán sau khi hệ thống nhận được phản hồi thanh toán thành công.`,
  },
  {
    categoryCode: 'payment_refund',
    title: 'Xử lý khi tài xế không có tiền thối lại',
    keywords: ['tiền thối', 'không có tiền lẻ', 'thối tiền', 'chuyển khoản'],
    sortOrder: 3,
    body: `### Nếu tài xế không đủ tiền thối:
- Bạn có thể hỏi tài xế số tài khoản ngân hàng để **chuyển khoản trực tiếp** số tiền tương ứng cho tài xế.
- Hoặc hai bên có thể thoả thuận ghé cửa hàng tiện lợi / tạp hoá gần nhất để đổi tiền lẻ an toàn.`,
  },

  // Category 3: Sự cố & Khiếu nại
  {
    categoryCode: 'issues_complaints',
    title: 'Đơn hàng bị thiếu món hoặc sai món phải làm sao?',
    keywords: ['thiếu món', 'sai món', 'không đúng món', 'quên món'],
    sortOrder: 1,
    body: `### Quy trình xử lý khi thiếu hoặc sai món:
1. Vào **Trung tâm trợ giúp** → Chọn đơn hàng vừa nhận trong mục **Đơn hàng gần đây** (hoặc bấm **Báo vấn đề** ở màn hình chi tiết đơn).
2. Chọn lý do **"Thiếu món"** hoặc **"Sai món"**.
3. Tích chọn cụ thể món bị ảnh hưởng và số lượng thiếu.
4. Chụp ảnh hoá đơn và toàn bộ món nhận được để hệ thống hỗ trợ giải quyết hoặc tặng voucher bù đắp nhanh chóng.`,
  },
  {
    categoryCode: 'issues_complaints',
    title: 'Món ăn bị đổ, vỡ hoặc hư hỏng trong quá trình giao',
    keywords: ['đổ món', 'hỏng', 'bị vỡ', 'rách túi', 'tràn nước'],
    sortOrder: 2,
    body: `### Khi món ăn bị đổ hoặc hư hỏng:
- Vui lòng chụp rõ ảnh hộp món bị đổ/hỏng và tình trạng túi đựng khi tài xế giao tới.
- Vào mục **Báo vấn đề với đơn** trong vòng **24 giờ** kể từ lúc giao hàng, đính kèm hình ảnh và mô tả sự cố.
- Bộ phận CSKH sẽ xem xét và xử lý bồi thường hoặc hoàn trả theo đúng quy định.`,
  },
  {
    categoryCode: 'issues_complaints',
    title: 'Đơn hàng giao quá trễ so với thời gian dự kiến',
    keywords: ['giao trễ', 'quá lâu', 'chờ lâu', 'chậm trễ'],
    sortOrder: 3,
    body: `### Tại sao đơn hàng bị trễ?
Đơn hàng có thể chậm hơn dự kiến do:
- Thời tiết xấu (mưa to, ngập nước).
- Quán ăn đang trong khung giờ cao điểm quá tải đơn.
- Tuyến đường bị kẹt xe hoặc tài xế gặp sự cố xe cộ.

Nếu đơn trễ quá 20 phút so với dự kiến, bạn có thể gửi yêu cầu hỗ trợ để nhận voucher xin lỗi từ ZomZom.`,
  },
  {
    categoryCode: 'issues_complaints',
    title: 'Phản ánh tài xế có thái độ chưa chuẩn mực',
    keywords: ['thái độ tài xế', 'bất lịch sự', 'gắt gỏng', 'khiếu nại tài xế'],
    sortOrder: 4,
    body: `### Góp ý thái độ phục vụ:
- Sau khi nhận đơn, bạn có thể đánh giá số sao (1–5 sao) và ghi nhận xét trong phần **Đánh giá tài xế**.
- Nếu có sự việc nghiêm trọng, vui lòng tạo phiếu hỗ trợ đính kèm mã đơn hàng để quản trị viên kiểm tra và có biện pháp xử lý kỷ luật đối với tài xế.`,
  },

  // Category 4: Tài khoản & Đăng ký đối tác
  {
    categoryCode: 'account_partner',
    title: 'Làm thế nào để xoá tài khoản ZomZom?',
    keywords: ['xoá tài khoản', 'delete account', 'huỷ tài khoản', 'xoá dữ liệu'],
    sortOrder: 1,
    body: `### Hướng dẫn xoá tài khoản
1. Mở tab **Tài khoản** → chọn **Thông tin cá nhân & mật khẩu**.
2. Cuộn xuống cuối cùng tại mục màu đỏ **"Vùng nguy hiểm: Xoá tài khoản"**.
3. Bấm **"Xoá tài khoản này"** và xác nhận trong hộp thoại.

*Điều kiện:* Bạn không được có đơn hàng nào đang trong quá trình giao hoặc nợ tiền chưa thanh toán. Khi xoá, toàn bộ dữ liệu cá nhân (tên, SĐT, email) sẽ được ẩn danh vĩnh viễn theo chuẩn bảo mật.`,
  },
  {
    categoryCode: 'account_partner',
    title: 'Tại sao tài khoản của tôi bị tạm khoá hoặc giới hạn đặt đơn?',
    keywords: ['bị khoá', 'khoá tài khoản', 'không đặt được', 'khoá đơn'],
    sortOrder: 2,
    body: `### Nguyên nhân tài khoản bị giới hạn:
Hệ thống ZomZom tự động bảo vệ đối tác nhà hàng và tài xế trước rủi ro "bom hàng":
- Nếu tài khoản có **≥ 2 lần giao hàng thất bại** do lỗi từ phía khách (không nghe máy, không nhận món khi tài xế đã tới nơi), tài khoản sẽ bị hạn chế đặt đơn mới.
- Vui lòng liên hệ bộ phận hỗ trợ nếu bạn cần mở lại tài khoản và cam kết nhận hàng.`,
  },
  {
    categoryCode: 'account_partner',
    title: 'Hướng dẫn đăng ký trở thành Đối tác Quán ăn ZomZom',
    keywords: ['mở quán', 'bán hàng', 'đăng ký quán', 'đối tác nhà hàng'],
    sortOrder: 3,
    body: `### Đăng ký mở quán trên ZomZom:
1. Đăng ký tài khoản trên ứng dụng với vai trò thông thường.
2. Vào tab **Tài khoản** → chọn **"Đăng ký mở quán ăn"**.
3. Cung cấp tên quán, địa chỉ toạ độ chính xác, số điện thoại liên hệ và ảnh giấy tờ kinh doanh/menu món.
4. Quản trị viên sẽ xét duyệt trong vòng 24–48 giờ làm việc. Khi được duyệt, giao diện của bạn sẽ tự động chuyển sang giao diện Quản lý Quán ăn.`,
  },
  {
    categoryCode: 'account_partner',
    title: 'Hướng dẫn đăng ký trở thành Tài xế giao hàng ZomZom',
    keywords: ['làm tài xế', 'chạy xe', 'shipper', 'đăng ký tài xế'],
    sortOrder: 4,
    body: `### Đăng ký trở thành Tài xế:
1. Vào tab **Tài khoản** → chọn **"Đăng ký làm tài xế"**.
2. Cung cấp thông tin: Căn cước công dân, Giấy phép lái xe, Biển số xe máy và Số tài khoản ngân hàng nhận tiền.
3. Sau khi Admin kiểm tra và kích hoạt tài khoản, bạn có thể gạt công tắc **"Sẵn sàng nhận đơn"** để bắt đầu nhận cuốc và gia tăng thu nhập.`,
  },
];

