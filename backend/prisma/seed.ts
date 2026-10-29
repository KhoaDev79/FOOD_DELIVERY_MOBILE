import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus, VoucherType } from '@prisma/client';
import { hashSecret } from '../src/common/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu gieo dữ liệu mẫu toàn diện (Phase 1 Full Seed)...');

  // Xoá dữ liệu cũ theo thứ tự ràng buộc khoá ngoại (Idempotent Reseed)
  await prisma.review.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await hashSecret('Password123!');

  // =========================================================================
  // 1. TÀI KHOẢN DEMO (8 User đại diện 4 vai trò)
  // =========================================================================
  const admin = await prisma.user.create({
    data: {
      email: 'admin@fooddelivery.com',
      fullName: 'Quản trị viên Hệ thống',
      phone: '0900000001',
      role: Role.ADMIN,
      passwordHash: defaultPasswordHash,
    },
  });

  const owner1 = await prisma.user.create({
    data: {
      email: 'owner@fooddelivery.com',
      fullName: 'Nguyễn Văn Chủ Quán',
      phone: '0900000002',
      role: Role.RESTAURANT_OWNER,
      passwordHash: defaultPasswordHash,
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: 'owner2@fooddelivery.com',
      fullName: 'Trần Thị Chủ Quán 2',
      phone: '0900000012',
      role: Role.RESTAURANT_OWNER,
      passwordHash: defaultPasswordHash,
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      email: 'driver@fooddelivery.com',
      fullName: 'Trần Văn Tài Xế',
      phone: '0900000003',
      role: Role.DRIVER,
      passwordHash: defaultPasswordHash,
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      email: 'driver2@fooddelivery.com',
      fullName: 'Lê Văn Tài Xế 2',
      phone: '0900000013',
      role: Role.DRIVER,
      passwordHash: defaultPasswordHash,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer@fooddelivery.com',
      fullName: 'Lê Khách Hàng',
      phone: '0900000004',
      role: Role.CUSTOMER,
      passwordHash: defaultPasswordHash,
      addresses: {
        create: [
          {
            label: 'Nhà riêng',
            addressLine: '123 Đường Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh',
            latitude: 10.7745,
            longitude: 106.7025,
            isDefault: true,
            isManual: false,
            needsConfirmation: false,
          },
          {
            label: 'Nhà riêng Gò Vấp',
            addressLine: '123 Nguyễn Văn Lượng, Phường An Hội, TP. Hồ Chí Minh',
            latitude: 10.842,
            longitude: 106.671,
            isDefault: false,
            isManual: true,
            needsConfirmation: false,
          },
        ],
      },
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@fooddelivery.com',
      fullName: 'Phạm Thị Khách Hàng 2',
      phone: '0900000014',
      role: Role.CUSTOMER,
      passwordHash: defaultPasswordHash,
      addresses: {
        create: [
          {
            label: 'Văn phòng',
            addressLine: '45 Lê Duẩn, Phường Bến Nghé, TP. Hồ Chí Minh',
            latitude: 10.7812,
            longitude: 106.6998,
            isDefault: true,
            isManual: false,
          },
        ],
      },
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      email: 'customer3@fooddelivery.com',
      fullName: 'Hoàng Minh Khách Hàng 3',
      phone: '0900000024',
      role: Role.CUSTOMER,
      passwordHash: defaultPasswordHash,
    },
  });

  // =========================================================================
  // 2. BANNERS QUẢNG CÁO & BỘ SƯU TẬP TRANG CHỦ
  // =========================================================================
  await prisma.banner.createMany({
    data: [
      {
        title: 'Miễn Phí Giao Hàng - Nhập FREESHIP',
        imageUrl: '/public/images/food/default.svg',
        actionType: 'COLLECTION',
        actionValue: 'freeship',
        sortOrder: 1,
      },
      {
        title: 'Món Ngon Gần Bạn - Giao Dưới 20 Phút',
        imageUrl: '/public/images/food/comtam.svg',
        actionType: 'COLLECTION',
        actionValue: 'nearby',
        sortOrder: 2,
      },
      {
        title: 'Quán Hot Đánh Giá 5 Sao - Giảm 20K',
        imageUrl: '/public/images/food/pho.svg',
        actionType: 'COLLECTION',
        actionValue: 'top_rated',
        sortOrder: 3,
      },
      {
        title: 'Thực Đơn Tiết Kiệm - Chỉ Từ 25.000đ',
        imageUrl: '/public/images/food/banhmi.svg',
        actionType: 'COLLECTION',
        actionValue: 'budget',
        sortOrder: 4,
      },
    ],
  });

  // =========================================================================
  // 3. VOUCHERS KHUYẾN MÃI (4-6 voucher đủ trường hợp biên)
  // =========================================================================
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const voucherFreeship = await prisma.voucher.create({
    data: {
      code: 'FREESHIP',
      title: 'Miễn Phí Vận Chuyển',
      description: 'Giảm tối đa 20.000đ phí giao hàng cho đơn từ 50.000đ',
      discountType: VoucherType.FREE_SHIP,
      discountValue: 20000,
      minOrderAmount: 50000,
      maxUsage: 500,
      usedCount: 15,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  const voucherGiam20k = await prisma.voucher.create({
    data: {
      code: 'GIAM20K',
      title: 'Giảm Ngay 20.000đ',
      description: 'Áp dụng cho đơn hàng từ 60.000đ',
      discountType: VoucherType.FIXED_AMOUNT,
      discountValue: 20000,
      minOrderAmount: 60000,
      maxUsage: 200,
      usedCount: 40,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  const voucherGiam30k = await prisma.voucher.create({
    data: {
      code: 'GIAM30K',
      title: 'Giảm Lớn 30.000đ',
      description: 'Áp dụng cho đơn hàng từ 120.000đ',
      discountType: VoucherType.FIXED_AMOUNT,
      discountValue: 30000,
      minOrderAmount: 120000,
      maxUsage: 100,
      usedCount: 20,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  const voucherPercent = await prisma.voucher.create({
    data: {
      code: 'GIAM20PHANTRAM',
      title: 'Giảm 20% Tối Đa 40K',
      description: 'Giảm 20% cho đơn từ 100.000đ, tối đa 40.000đ',
      discountType: VoucherType.PERCENTAGE,
      discountValue: 20,
      maxDiscountAmount: 40000,
      minOrderAmount: 100000,
      maxUsage: 100,
      usedCount: 10,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  // Trường hợp biên: Voucher đã hết hạn
  await prisma.voucher.create({
    data: {
      code: 'HETHAN50',
      title: 'Voucher Đã Hết Hạn [Test]',
      description: 'Mã giảm 50.000đ đã kết thúc thời gian áp dụng',
      discountType: VoucherType.FIXED_AMOUNT,
      discountValue: 50000,
      minOrderAmount: 100000,
      maxUsage: 100,
      usedCount: 5,
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: pastDate,
      isActive: true,
    },
  });

  // Trường hợp biên: Voucher đã hết sạch lượt dùng (usedCount = maxUsage)
  await prisma.voucher.create({
    data: {
      code: 'HETLUOT',
      title: 'Voucher Hết Lượt Dùng [Test]',
      description: 'Mã giảm 25.000đ nhưng đã dùng hết số lượng',
      discountType: VoucherType.FIXED_AMOUNT,
      discountValue: 25000,
      minOrderAmount: 50000,
      maxUsage: 10,
      usedCount: 10,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  // =========================================================================
  // 4. SCHEMA TUỲ CHỌN MÓN (Size, Topping, Độ cay)
  // =========================================================================
  const drinkOptions = {
    sizes: [
      { id: 'M', name: 'Size M (Vừa)', price: 0 },
      { id: 'L', name: 'Size L (Lớn)', price: 8000 },
    ],
    toppings: [
      { id: 'tran_chau_den', name: 'Trân Châu Đen Hoàng Gia', price: 6000 },
      { id: 'thach_trai_cay', name: 'Thạch Trái Cây 3 Màu', price: 6000 },
      { id: 'kem_cheese', name: 'Kem Cheese Macchiato', price: 10000 },
    ],
    sugarLevels: ['0%', '30%', '50%', '70%', '100%'],
    iceLevels: ['0%', '30%', '50%', '70%', '100%'],
  };

  const noodleOptions = {
    sizes: [
      { id: 'to_thuong', name: 'Tô Thường', price: 0 },
      { id: 'to_dac_biet', name: 'Tô Đặc Biệt (Nhiều Thịt)', price: 15000 },
    ],
    toppings: [
      { id: 'quay_gion', name: 'Quẩy Giòn Nóng (2 cái)', price: 8000 },
      { id: 'trung_chan', name: 'Trứng Chần Lòng Đào', price: 7000 },
      { id: 'tiet_bo', name: 'Tiết Luộc Béo', price: 5000 },
    ],
    spiceLevels: ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Cay nhiều'],
  };

  const riceOptions = {
    sizes: [
      { id: 'dia_thuong', name: 'Phần Thường', price: 0 },
      { id: 'them_com', name: 'Thêm Cơm & Canh', price: 5000 },
    ],
    toppings: [
      { id: 'trung_op_la', name: 'Trứng Ốp La Lòng Đào', price: 7000 },
      { id: 'cha_trung', name: 'Chả Trứng Nướng', price: 10000 },
      { id: 'canh_kho_qua', name: 'Canh Khổ Qua Nhồi Thịt', price: 15000 },
    ],
  };

  // =========================================================================
  // 5. DANH SÁCH 18 NHÀ HÀNG HƯ CẤU (Bao gồm các trường hợp biên bắt buộc)
  // =========================================================================
  const restaurantsData = [
    {
      name: 'Phở Bò Gia Truyền Phố Cổ',
      description: 'Nước dùng ninh xương bò 24 giờ thơm lừng, thịt bò tươi mềm ngọt',
      imageUrl: '/public/images/food/pho.svg',
      address: '45 Lê Thánh Tôn, Phường Bến Nghé, TP. Hồ Chí Minh',
      latitude: 10.7782,
      longitude: 106.7011,
      deliveryRadiusKm: 12,
      isOpen: true,
      rating: 4.9,
      openTime: '06:00',
      closeTime: '22:30',
      priceRange: '50.000đ - 95.000đ',
      categories: [
        {
          name: 'Phở Bò Đậm Vị',
          items: [
            { name: 'Phở Tái Nạm Gầu Bò', price: 65000, discountPrice: 55000, description: 'Bò tái mềm, nạm giòn ngọt thơm ngậy', imageUrl: '/public/images/food/pho.svg', options: noodleOptions, isAvailable: true },
            { name: 'Phở Tái Lăn Phố Cổ', price: 75000, description: 'Thịt bò xào lăn lửa lớn dậy mùi tỏi tiêu', imageUrl: '/public/images/food/pho.svg', options: noodleOptions, isAvailable: true },
            { name: 'Phở Bắp Bò Hoa Thượng Hạng', price: 85000, description: 'Bắp hoa bò giòn sần sật nhúng vừa chín tới', imageUrl: '/public/images/food/pho.svg', options: noodleOptions, isAvailable: true },
            { name: 'Phở Gầu Giòn Hết Hàng [Biên: Hết món]', price: 70000, description: 'Món đã tạm ngưng phục vụ trong ngày', imageUrl: '/public/images/food/pho.svg', isAvailable: false },
          ],
        },
        {
          name: 'Đồ Ăn Kèm & Nước',
          items: [
            { name: 'Quẩy Giòn Nóng Hổi', price: 10000, description: 'Quẩy vàng ruộm chấm nước phở', imageUrl: '/public/images/food/pho.svg', isAvailable: true },
            { name: 'Trứng Chần Nước Béo', price: 8000, description: 'Trứng gà ta chần lòng đào', imageUrl: '/public/images/food/pho.svg', isAvailable: true },
            { name: 'Trà Chanh Hà Nội', price: 15000, description: 'Trà lài chanh tươi mát lạnh', imageUrl: '/public/images/food/traicay.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Cơm Tấm Đêm Sài Gòn',
      description: 'Sườn nướng than hoa vàng óng mật ong, bì thơm chả bùi',
      imageUrl: '/public/images/food/comtam.svg',
      address: '18 Nguyễn Du, Phường Bến Nghé, TP. Hồ Chí Minh',
      latitude: 10.7758,
      longitude: 106.6995,
      deliveryRadiusKm: 10,
      isOpen: true,
      rating: 4.8,
      openTime: '10:00',
      closeTime: '02:00',
      priceRange: '45.000đ - 85.000đ',
      categories: [
        {
          name: 'Cơm Tấm Truyền Thống',
          items: [
            { name: 'Cơm Tấm Sườn Cốt Lết', price: 45000, description: 'Sườn cốt lết dày thịt ướp gia vị đậm đà', imageUrl: '/public/images/food/comtam.svg', options: riceOptions, isAvailable: true },
            { name: 'Cơm Tấm Sườn Bì Chả Trứng', price: 65000, discountPrice: 58000, description: 'Phần đặc biệt đầy đủ topping', imageUrl: '/public/images/food/comtam.svg', options: riceOptions, isAvailable: true },
            { name: 'Cơm Tấm Đùi Gà Xối Mỡ', price: 55000, description: 'Đùi gà vàng rụm sốt nước mắm tỏi', imageUrl: '/public/images/food/comga.svg', options: riceOptions, isAvailable: true },
          ],
        },
        {
          name: 'Canh & Tráng Miệng',
          items: [
            { name: 'Canh Rong Biển Thịt Bằm', price: 15000, imageUrl: '/public/images/food/comtam.svg', isAvailable: true },
            { name: 'Trà Sâm Dứa Hạt É', price: 10000, imageUrl: '/public/images/food/trasua.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Bún Bò Huế Cố Đô',
      description: 'Chuẩn vị cay nồng sa tế xứ Huế, chả cua tươi ngon',
      imageUrl: '/public/images/food/bunbo.svg',
      address: '78 Bạch Đằng, Phường Gia Định, TP. Hồ Chí Minh',
      latitude: 10.8012,
      longitude: 106.7105,
      deliveryRadiusKm: 8,
      isOpen: true,
      rating: 4.7,
      openTime: '06:30',
      closeTime: '21:00',
      priceRange: '45.000đ - 75.000đ',
      categories: [
        {
          name: 'Bún Bò',
          items: [
            { name: 'Bún Bò Nạm Chả Cua', price: 50000, description: 'Thịt bò nạm mềm thơm cùng chả cua vàng ươm', imageUrl: '/public/images/food/bunbo.svg', options: noodleOptions, isAvailable: true },
            { name: 'Bún Bò Gân Bắp Giò Heo', price: 65000, description: 'Tô lớn đầy đặn khoanh giò nạc', imageUrl: '/public/images/food/bunbo.svg', options: noodleOptions, isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Bánh Mì Giòn Rụm Sài Gòn',
      description: 'Vỏ bánh nóng giòn tan, pate bơ nhà làm béo ngậy',
      imageUrl: '/public/images/food/banhmi.svg',
      address: '18 Nguyễn Trãi, Phường Bến Thành, TP. Hồ Chí Minh',
      latitude: 10.768,
      longitude: 106.6935,
      deliveryRadiusKm: 7,
      isOpen: true,
      rating: 4.9,
      openTime: '06:00',
      closeTime: '23:00',
      priceRange: '20.000đ - 45.000đ',
      categories: [
        {
          name: 'Bánh Mì Thịt & Chả',
          items: [
            { name: 'Bánh Mì Thập Cẩm Đặc Biệt', price: 35000, discountPrice: 29000, description: 'Pate, giò thủ, chả lụa, xá xíu, dưa chua', imageUrl: '/public/images/food/banhmi.svg', isAvailable: true },
            { name: 'Bánh Mì Xíu Mại Trứng Muối', price: 40000, description: 'Viên xíu mại đẫm sốt cùng trứng muối béo', imageUrl: '/public/images/food/banhmi.svg', isAvailable: true },
            { name: 'Bánh Mì Gà Xé Bơ Tỏi', price: 30000, description: 'Gà xé sốt bơ trứng nhà làm', imageUrl: '/public/images/food/banhmi.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Trà Sữa Nhà Làm Trân Châu',
      description: 'Trà sữa đậm vị lá trà tự nhiên kết hợp sữa tươi thanh trùng',
      imageUrl: '/public/images/food/trasua.svg',
      address: '240 Tô Hiến Thành, Phường Hoà Hưng, TP. Hồ Chí Minh',
      latitude: 10.7731,
      longitude: 106.6667,
      deliveryRadiusKm: 9,
      isOpen: true,
      rating: 4.8,
      openTime: '08:00',
      closeTime: '23:00',
      priceRange: '28.000đ - 55.000đ',
      categories: [
        {
          name: 'Trà Sữa Đậm Vị',
          items: [
            { name: 'Trà Sữa Ô Long Nướng Trân Châu', price: 35000, discountPrice: 28000, description: 'Vị trà rang thơm ngậy, topping trân châu dai giòn', imageUrl: '/public/images/food/trasua.svg', options: drinkOptions, isAvailable: true },
            { name: 'Trà Sữa Matcha Nhật Bản', price: 42000, description: 'Bột matcha nguyên chất từ Uji Nhật', imageUrl: '/public/images/food/trasua.svg', options: drinkOptions, isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Gà Rán Giòn Cay Hương Việt',
      description: 'Gà tươi rán giòn tan, nước sốt cay ngọt Hàn Quốc',
      imageUrl: '/public/images/food/garan.svg',
      address: '89 Phan Xích Long, Phường Cầu Kiệu, TP. Hồ Chí Minh',
      latitude: 10.7985,
      longitude: 106.678,
      deliveryRadiusKm: 8,
      isOpen: true,
      rating: 4.6,
      openTime: '09:30',
      closeTime: '22:00',
      priceRange: '39.000đ - 180.000đ',
      categories: [
        {
          name: 'Gà Rán Miếng',
          items: [
            { name: 'Gà Rán Sốt Cay Ngọt (2 miếng)', price: 79000, description: 'Gà sốt đỏ cay ngọt chuẩn vị', imageUrl: '/public/images/food/garan.svg', isAvailable: true },
            { name: 'Khoai Tây Chiên Lắc Phô Mai', price: 35000, imageUrl: '/public/images/food/garan.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Hủ Tiếu Nam Vang Miền Tây',
      description: 'Hủ tiếu khô trộn sốt đặc biệt, nước lèo xương tôm mực ngọt lịm',
      imageUrl: '/public/images/food/hutieu.svg',
      address: '154 Trần Hưng Đạo, Phường Chợ Quán, TP. Hồ Chí Minh',
      latitude: 10.7554,
      longitude: 106.6622,
      deliveryRadiusKm: 8,
      isOpen: true,
      rating: 4.8,
      openTime: '06:00',
      closeTime: '22:00',
      priceRange: '45.000đ - 70.000đ',
      categories: [
        {
          name: 'Hủ Tiếu Đặc Sắc',
          items: [
            { name: 'Hủ Tiếu Nam Vang Khô Đặc Biệt', price: 60000, discountPrice: 52000, description: 'Tôm tươi, tim, cật, thịt bằm, trứng cút', imageUrl: '/public/images/food/hutieu.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Cà Phê Muối Cố Đô',
      description: 'Cà phê phin truyền thống quyện lớp kem muối béo ngậy ngọt mặn',
      imageUrl: '/public/images/food/caphe.svg',
      address: '123 Nguyễn Văn Lượng, Phường An Hội, TP. Hồ Chí Minh',
      latitude: 10.842,
      longitude: 106.671,
      deliveryRadiusKm: 7,
      isOpen: true,
      rating: 4.9,
      openTime: '06:30',
      closeTime: '22:30',
      priceRange: '22.000đ - 45.000đ',
      categories: [
        {
          name: 'Cà Phê & Kem Muối',
          items: [
            { name: 'Cà Phê Muối Đặc Biệt', price: 29000, discountPrice: 25000, description: 'Lớp kem béo mịn màng cùng cà phê thơm nồng', imageUrl: '/public/images/food/caphe.svg', options: drinkOptions, isAvailable: true },
            { name: 'Bạc Xỉu Ba Tầng Sữa Dừa', price: 32000, imageUrl: '/public/images/food/caphe.svg', options: drinkOptions, isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Mì Cay Hàn Quốc 7 Cấp Độ',
      description: 'Nước lẩu tomyum chua cay đậm đà, hải sản tôm mực tươi ngon',
      imageUrl: '/public/images/food/micay.svg',
      address: '312 Hoàng Văn Thụ, Phường Tân Bình, TP. Hồ Chí Minh',
      latitude: 10.795,
      longitude: 106.652,
      deliveryRadiusKm: 8,
      isOpen: true,
      rating: 4.6,
      openTime: '09:00',
      closeTime: '22:30',
      priceRange: '45.000đ - 89.000đ',
      categories: [
        {
          name: 'Mì Cay Thố Đất',
          items: [
            { name: 'Mì Cay Hải Sản Cấp 2', price: 55000, description: 'Tôm càng, mực, nghêu, chả cá Hàn Quốc', imageUrl: '/public/images/food/micay.svg', options: noodleOptions, isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Bún Chả Hà Nội Hương Xưa',
      description: 'Chả nướng than hoa thơm lừng ăn kèm nước mắm đu đủ chua ngọt',
      imageUrl: '/public/images/food/buncha.svg',
      address: '26 Lê Duẩn, Phường Bến Nghé, TP. Hồ Chí Minh',
      latitude: 10.778,
      longitude: 106.702,
      deliveryRadiusKm: 10,
      isOpen: true,
      rating: 4.7,
      openTime: '07:00',
      closeTime: '21:00',
      priceRange: '50.000đ - 85.000đ',
      categories: [
        {
          name: 'Bún Chả & Nem Rán',
          items: [
            { name: 'Bún Chả Nướng Đầy Đủ', price: 60000, description: 'Chả viên, chả miếng nướng than, rau ghém tươi', imageUrl: '/public/images/food/buncha.svg', isAvailable: true },
            { name: 'Nem Cua Bể Giòn Rụm (2 chiếc)', price: 35000, imageUrl: '/public/images/food/buncha.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Chè Bưởi & Tráng Miệng Ngọt Ngào',
      description: 'Chè khúc bạch thanh mát, chè bưởi An Giang cùi giòn sần sật',
      imageUrl: '/public/images/food/che.svg',
      address: '35 Nơ Trang Long, Phường Bình Thạnh, TP. Hồ Chí Minh',
      latitude: 10.812,
      longitude: 106.695,
      deliveryRadiusKm: 6,
      isOpen: true,
      rating: 4.8,
      openTime: '10:00',
      closeTime: '22:00',
      priceRange: '25.000đ - 45.000đ',
      categories: [
        {
          name: 'Chè Truyền Thống',
          items: [
            { name: 'Chè Bưởi Cốt Dừa Béo', price: 28000, imageUrl: '/public/images/food/che.svg', isAvailable: true },
            { name: 'Chè Khúc Bạch Phô Mai Hạnh Nhân', price: 35000, imageUrl: '/public/images/food/che.svg', isAvailable: true },
          ],
        },
      ],
    },
    // TRƯỜNG HỢP BIÊN 1: Quán đang ĐÓNG CỬA (isOpen: false)
    {
      name: 'Bánh Cuốn Nóng Tây Hồ [Biên: Đang đóng cửa]',
      description: 'Bánh cuốn tráng tay nóng hổi chả quế lá chuối (Hiện quán đang đóng)',
      imageUrl: '/public/images/food/banhcuon.svg',
      address: '90 Nguyễn Đình Chiểu, Phường Đa Kao, TP. Hồ Chí Minh',
      latitude: 10.785,
      longitude: 106.682,
      deliveryRadiusKm: 6,
      isOpen: false, // Đang đóng cửa
      rating: 4.5,
      openTime: '06:00',
      closeTime: '13:00',
      priceRange: '30.000đ - 55.000đ',
      categories: [
        {
          name: 'Bánh Cuốn Nóng',
          items: [
            { name: 'Bánh Cuốn Nhân Thịt Mộc Nhĩ', price: 35000, imageUrl: '/public/images/food/banhcuon.svg', isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Cơm Gà Xối Mỡ Da Giòn',
      description: 'Cơm chiên hạt ngọc vàng ươm, gà xối mỡ giòn rụm',
      imageUrl: '/public/images/food/comga.svg',
      address: '42 Châu Văn Liêm, Phường Chợ Lớn, TP. Hồ Chí Minh',
      latitude: 10.758,
      longitude: 106.671,
      deliveryRadiusKm: 8,
      isOpen: true,
      rating: 4.7,
      openTime: '10:30',
      closeTime: '21:30',
      priceRange: '40.000đ - 70.000đ',
      categories: [
        {
          name: 'Cơm Gà',
          items: [
            { name: 'Cơm Gà Xối Mỡ Đùi Góc Tư', price: 55000, discountPrice: 49000, imageUrl: '/public/images/food/comga.svg', options: riceOptions, isAvailable: true },
          ],
        },
      ],
    },
    {
      name: 'Trà Trái Cây Nhiệt Đới',
      description: 'Trái cây tươi ngâm trong ngày, mát lạnh sảng khoái',
      imageUrl: '/public/images/food/traicay.svg',
      address: '512 Sư Vạn Hạnh, Phường Vườn Lài, TP. Hồ Chí Minh',
      latitude: 10.769,
      longitude: 106.672,
      deliveryRadiusKm: 7,
      isOpen: true,
      rating: 4.8,
      openTime: '08:30',
      closeTime: '22:30',
      priceRange: '30.000đ - 55.000đ',
      categories: [
        {
          name: 'Trà Trái Cây Tươi',
          items: [
            { name: 'Trà Ổi Hồng Dã Tay', price: 35000, imageUrl: '/public/images/food/traicay.svg', options: drinkOptions, isAvailable: true },
          ],
        },
      ],
    },
    // TRƯỜNG HỢP BIÊN 2: Danh sách thực đơn dài HƠN 20 MÓN (>20 items)
    {
      name: 'Lẩu & Nướng Tự Chọn Phố Đêm [Biên: Thực đơn >20 món]',
      description: 'Buffet nướng lẩu tự chọn với hơn 20 món đa dạng giá rẻ',
      imageUrl: '/public/images/food/lau.svg',
      address: '68 Quang Trung, Phường Gò Vấp, TP. Hồ Chí Minh',
      latitude: 10.828,
      longitude: 106.689,
      deliveryRadiusKm: 9,
      isOpen: true,
      rating: 4.7,
      openTime: '15:00',
      closeTime: '23:59',
      priceRange: '15.000đ - 199.000đ',
      categories: [
        {
          name: 'Thịt & Hải Sản Nướng',
          items: Array.from({ length: 12 }, (_, i) => ({
            name: `Món Nướng Đặc Biệt Số ${i + 1}`,
            price: 45000 + i * 5000,
            description: `Thịt nướng ướp sốt cay thơm lừng loại ${i + 1}`,
            imageUrl: '/public/images/food/lau.svg',
            isAvailable: true,
          })),
        },
        {
          name: 'Topping Lẩu & Rau Nấm',
          items: Array.from({ length: 10 }, (_, i) => ({
            name: `Topping Thả Lẩu Loại ${i + 1}`,
            price: 15000 + i * 3000,
            description: `Thực phẩm thả lẩu tươi sạch loại ${i + 1}`,
            imageUrl: '/public/images/food/lau.svg',
            isAvailable: true,
          })),
        },
      ],
    },
    {
      name: 'Pizza Ý Lò Củi Thủ Công',
      description: 'Đế bánh bột ủ 48 giờ nướng lò củi thơm mùi khói sồi',
      imageUrl: '/public/images/food/pizza.svg',
      address: '12 Xuân Thủy, Phường Thảo Điền, TP. Thủ Đức',
      latitude: 10.805,
      longitude: 106.735,
      deliveryRadiusKm: 10,
      isOpen: true,
      rating: 4.9,
      openTime: '11:00',
      closeTime: '22:00',
      priceRange: '95.000đ - 280.000đ',
      categories: [
        {
          name: 'Pizza Thủ Công',
          items: [
            { name: 'Pizza Margherita Phô Mai Tươi', price: 145000, description: 'Sốt cà chua Ý, Mozzarella tươi, lá quế tây', imageUrl: '/public/images/food/pizza.svg', isAvailable: true },
          ],
        },
      ],
    },
    // TRƯỜNG HỢP BIÊN 3: Quán NGOÀI BÁN KÍNH PHỤC VỤ (>25km tại Cần Giờ)
    {
      name: 'Hải Sản Tươi Sống Cần Giờ [Biên: Ngoài bán kính phục vụ]',
      description: 'Cua biển, tôm hùm tươi sống vùng duyên hải Cần Giờ (khoảng cách >25km)',
      imageUrl: '/public/images/food/default.svg',
      address: 'Đường Duyên Hải, Xã Long Hòa, TP. Hồ Chí Minh',
      latitude: 10.412,
      longitude: 106.96,
      deliveryRadiusKm: 5, // Bán kính 5km, trong khi khách ở trung tâm TP.HCM >25km
      isOpen: true,
      rating: 4.8,
      openTime: '09:00',
      closeTime: '21:00',
      priceRange: '120.000đ - 450.000đ',
      categories: [
        {
          name: 'Hải Sản Tươi Sống',
          items: [
            { name: 'Cua Biển Rang Me Cần Giờ (1 con)', price: 250000, imageUrl: '/public/images/food/default.svg', isAvailable: true },
          ],
        },
      ],
    },
    // TRƯỜNG HỢP BIÊN 4: Quán KHÔNG CÓ ẢNH (imageUrl: null) & TÊN RẤT DÀI
    {
      name: 'Quán Ẩm Thực Cố Đô Chuyên Các Món Bún Bò Xứ Huế Truyền Thống Nổi Tiếng Đậm Đà Xứ Thần Kinh [Biên: Tên dài & Không ảnh]',
      description: 'Quán gia truyền phục vụ bún bò lâu năm (Trường hợp biên: tên siêu dài và imageUrl để null)',
      imageUrl: null, // Không có ảnh đại diện
      address: '22 Võ Văn Tần, Phường Xuân Hoà, TP. Hồ Chí Minh',
      latitude: 10.782,
      longitude: 106.689,
      deliveryRadiusKm: 7,
      isOpen: true,
      rating: 4.4,
      openTime: '06:00',
      closeTime: '20:00',
      priceRange: '35.000đ - 60.000đ',
      categories: [
        {
          name: 'Món Tiêu Biểu',
          items: [
            { name: 'Bún Bò Giò Heo Nước Trong', price: 45000, imageUrl: null, isAvailable: true },
          ],
        },
      ],
    },
  ];

  let totalItemsCount = 0;
  const createdRestaurants: any[] = [];
  const allCreatedMenuItems: any[] = [];

  for (let idx = 0; idx < restaurantsData.length; idx++) {
    const rData = restaurantsData[idx];
    const assignedOwner = idx % 2 === 0 ? owner1.id : owner2.id;

    const r = await prisma.restaurant.create({
      data: {
        ownerId: assignedOwner,
        name: rData.name,
        description: rData.description,
        imageUrl: rData.imageUrl,
        address: rData.address,
        latitude: rData.latitude,
        longitude: rData.longitude,
        deliveryRadiusKm: rData.deliveryRadiusKm,
        isOpen: rData.isOpen,
        rating: rData.rating,
        openTime: rData.openTime,
        closeTime: rData.closeTime,
        priceRange: rData.priceRange,
        isSample: true, // Cờ nhận diện dữ liệu mẫu sạch
      },
    });

    for (let cIdx = 0; cIdx < rData.categories.length; cIdx++) {
      const c = rData.categories[cIdx];
      const cat = await prisma.category.create({
        data: {
          restaurantId: r.id,
          name: c.name,
          sortOrder: cIdx + 1,
        },
      });

      for (const it of c.items) {
        totalItemsCount++;
        const item = await prisma.menuItem.create({
          data: {
            restaurantId: r.id,
            categoryId: cat.id,
            name: it.name,
            price: it.price,
            discountPrice: (it as any).discountPrice || null,
            description: it.description || null,
            imageUrl: it.imageUrl || null,
            options: (it as any).options || null,
            isAvailable: it.isAvailable !== false,
          },
        });
        allCreatedMenuItems.push(item);
      }
    }

    const fullRestaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: r.id },
      include: { menuItems: true },
    });
    createdRestaurants.push(fullRestaurant);
  }

  // =========================================================================
  // 6. TẠO 15 ĐƠN HÀNG MẪU Ở ĐỦ MỌI TRẠNG THÁI
  // =========================================================================
  const orderStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.PICKED_UP,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.CANCELLED,
  ];

  for (let i = 0; i < orderStatuses.length; i++) {
    const st = orderStatuses[i];
    const customer = i % 2 === 0 ? customer1 : customer2;
    const targetRestaurant = createdRestaurants[i % 5];
    const item = targetRestaurant.menuItems[0];
    const driver = ['PICKED_UP', 'DELIVERED', 'READY_FOR_PICKUP'].includes(st)
      ? (i % 2 === 0 ? driver1.id : driver2.id)
      : null;

    const subtotal = item ? item.price : 65000;
    const deliveryFee = 15000;
    const discount = i === 10 ? 20000 : 0; // Đơn 10 áp dụng voucher
    const total = subtotal + deliveryFee - discount;

    const ord = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: targetRestaurant.id,
        driverId: driver,
        status: st,
        paymentMethod: i % 3 === 0 ? PaymentMethod.VNPAY : PaymentMethod.COD,
        paymentStatus: st === OrderStatus.DELIVERED ? PaymentStatus.PAID : (i % 3 === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID),
        subtotal,
        deliveryFee,
        discountAmount: discount,
        voucherId: discount > 0 ? voucherGiam20k.id : null,
        total,
        distanceKm: 2.5,
        deliveryAddress: '123 Đường Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh',
        deliveryLat: 10.7745,
        deliveryLng: 106.7025,
        items: {
          create: [
            {
              menuItemId: item ? item.id : allCreatedMenuItems[0].id,
              name: item ? item.name : 'Món ăn đặc sản',
              unitPrice: subtotal,
              quantity: 1,
              lineTotal: subtotal,
            },
          ],
        },
        statusHistory: {
          create: [{ status: OrderStatus.PENDING, changedBy: customer.id }],
        },
      },
    });

    if (st !== OrderStatus.PENDING) {
      await prisma.orderStatusHistory.create({
        data: { orderId: ord.id, status: st, changedBy: driver || targetRestaurant.ownerId },
      });
    }
  }

  // =========================================================================
  // 7. TẠO 30 ĐÁNH GIÁ (REVIEWS) MẪU
  // =========================================================================
  const sampleComments = [
    'Món ăn rất ngon, nước dùng ngọt thanh nóng hổi!',
    'Giao hàng nhanh như chớp, tài xế lịch sự vui vẻ.',
    'Sườn nướng mật ong thơm phức, hạt cơm tấm mềm dẻo.',
    'Trà sữa ô long nướng thơm chuẩn vị, trân châu dai mềm ngon lắm.',
    'Đóng gói cẩn thận 2 lớp không bị đổ nước.',
    'Quán làm đồ ăn sạch sẽ, rất hợp khẩu vị gia đình mình.',
    'Giá cả hợp lý so với chất lượng, sẽ ủng hộ quán dài lâu.',
  ];

  for (let i = 0; i < 30; i++) {
    const rest = createdRestaurants[i % createdRestaurants.length];
    const cust = i % 3 === 0 ? customer1.id : i % 3 === 1 ? customer2.id : customer3.id;
    await prisma.review.create({
      data: {
        restaurantId: rest.id,
        customerId: cust,
        rating: 4 + (i % 2), // 4 hoặc 5 sao
        comment: sampleComments[i % sampleComments.length],
      },
    });
  }

  console.log(`\n================ BẢNG TỔNG KẾT DỮ LIỆU SEED (PHASE 1) ================`);
  console.log(`✅ Tổng số Nhà hàng ẩm thực: ${createdRestaurants.length} (Bao gồm đầy đủ các ca biên)`);
  console.log(`✅ Tổng số Món ăn trong thực đơn: ${totalItemsCount}`);
  console.log(`✅ Tổng số Tài khoản demo: 8 (1 Admin, 2 Owner, 2 Driver, 3 Customer)`);
  console.log(`✅ Tổng số Banners trang chủ: 4`);
  console.log(`✅ Tổng số Vouchers: 6 (Đủ loại: Freeship, Tiền mặt, Phần trăm, Hết hạn, Hết lượt)`);
  console.log(`✅ Tổng số Đơn hàng mẫu: 15 (Trải đều từ PENDING đến DELIVERED & CANCELLED)`);
  console.log(`✅ Tổng số Đánh giá (Reviews): 30`);
  console.log(`======================================================================\n`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
