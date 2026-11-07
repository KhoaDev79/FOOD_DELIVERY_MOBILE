import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('RBAC & Resource Ownership (Supertest E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customer1Token: string;
  let customer1Id: string;
  let customer2Token: string;

  let owner1Token: string;
  let owner1Id: string;
  let owner2Token: string;

  let driver1Token: string;
  let driver2Token: string;

  let restaurant1Id: string;
  let menuItem1Id: string;
  let restaurant1Coords: { lat: number; lng: number };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Lấy token đăng nhập từ các tài khoản mẫu
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123!' });
      return { token: res.body.data.accessToken, id: res.body.data.user.id };
    };

    // Owner 1
    const o1 = await login('owner@fooddelivery.com');
    owner1Token = o1.token;
    owner1Id = o1.id;

    // Driver 1
    const d1 = await login('driver@fooddelivery.com');
    driver1Token = d1.token;
    // Tài xế mẫu có thể đang giao đủ số đơn tối đa (dữ liệu seed / lần chạy trước) → hoàn tất các đơn đó
    // để test nhận đơn không bị chặn bởi giới hạn số đơn cùng lúc. Chỉ chạy trên database thử nghiệm.
    await app.get(PrismaService).order.updateMany({
      where: { driverId: d1.id, status: { in: ['READY_FOR_PICKUP', 'PICKED_UP'] } },
      data: { status: 'DELIVERED' },
    });

    // Customer 1
    const c1 = await login('customer@fooddelivery.com');
    customer1Token = c1.token;
    customer1Id = c1.id;

    // Tạo các tài khoản thứ 2 để test kiểm tra chéo quyền sở hữu (Cross-tenant / Ownership)
    const registerOrLogin = async (email: string, fullName: string, role: string, phone: string) => {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ email, fullName, password: 'Password123!', phone });
        if (role !== 'CUSTOMER') {
          await prisma.user.update({
            where: { id: res.body.data.user.id },
            data: { role: role as any },
          });
          return login(email);
        }
        return { token: res.body.data.accessToken, id: res.body.data.user.id };
      }
      return login(email);
    };

    const o2 = await registerOrLogin(
      'owner2@fooddelivery.com',
      'Chủ Quán 2',
      'RESTAURANT_OWNER',
      '0988000002',
    );
    owner2Token = o2.token;

    const c2 = await registerOrLogin(
      'customer2@fooddelivery.com',
      'Khách Hàng 2',
      'CUSTOMER',
      '0988000004',
    );
    customer2Token = c2.token;

    const d2 = await registerOrLogin(
      'driver2@fooddelivery.com',
      'Tài Xế 2',
      'DRIVER',
      '0988000003',
    );
    driver2Token = d2.token;

    // Lấy một nhà hàng của Owner 1
    const r1 = await prisma.restaurant.findFirst({
      where: { ownerId: owner1Id },
      include: { menuItems: { where: { isArchived: false } } },
    });
    if (r1) {
      restaurant1Id = r1.id;
      menuItem1Id = r1.menuItems[0]?.id;
      restaurant1Coords = { lat: r1.latitude, lng: r1.longitude };
      // Kết quả không phụ thuộc giờ chạy test: quán thử mở 24/24, không tạm nghỉ, món còn bán, không giới hạn khung giờ.
      // CHỈ chạy e2e trên database thử nghiệm (vd food_delivery_e2e), không chạy trên dữ liệu thật.
      await prisma.restaurant.update({
        where: { id: r1.id },
        data: { status: 'ACTIVE', isOpen: true, pausedUntil: null, openTime: '00:00', closeTime: '23:59' },
      });
      await prisma.restaurantOpeningHour.deleteMany({ where: { restaurantId: r1.id } });
      await prisma.restaurantSpecialClosing.deleteMany({ where: { restaurantId: r1.id } });
      await prisma.menuItem.update({
        where: { id: menuItem1Id },
        data: { isAvailable: true, soldOutUntil: null, availableFrom: null, availableTo: null, options: undefined },
      });
    }
  });

  /**
   * Đặt đơn theo đúng luồng của app: địa chỉ đã lưu (gần quán) → báo giá → tạo đơn kèm quoteToken.
   * Trả về id đơn.
   */
  const placeOrder = async (token: string): Promise<string> => {
    const server = app.getHttpServer();
    const addrRes = await request(server)
      .post('/api/v1/users/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'E2E',
        addressLine: '45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        latitude: restaurant1Coords.lat + 0.002,
        longitude: restaurant1Coords.lng + 0.002,
      });
    expect(addrRes.status).toBe(201);
    const addressId = addrRes.body.data.id;
    const body = { restaurantId: restaurant1Id, addressId, items: [{ menuItemId: menuItem1Id, quantity: 1 }] };

    const quoteRes = await request(server).post('/api/v1/orders/quote').set('Authorization', `Bearer ${token}`).send(body);
    expect(quoteRes.status).toBe(201);

    const createRes = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .send({ ...body, quoteToken: quoteRes.body.data.quoteToken });
    expect(createRes.status).toBe(201);
    return createRes.body.data.id;
  };

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. CHỦ QUÁN B KHÔNG SỬA ĐƯỢC QUÁN A (403 Forbidden)
  // =========================================================================
  it('Chủ quán B không được phép sửa thông tin nhà hàng của Chủ quán A', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/restaurants/${restaurant1Id}`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({ name: 'Tên quán bị tấn công thay đổi' });

    expect(res.status).toBe(403);
    expect(res.body.message || res.body.error).toContain('Bạn không phải chủ nhà hàng này');
  });

  // =========================================================================
  // 2. KHÁCH A KHÔNG ĐỌC ĐƯỢC ĐƠN KHÁCH B (403/404 Không lộ dữ liệu)
  // =========================================================================
  it('Khách A không được phép đọc chi tiết đơn hàng của Khách B', async () => {
    // Khách 2 tạo một đơn hàng
    const orderId = await placeOrder(customer2Token);

    // Khách 1 cố tình đọc đơn của Khách 2 -> Bị chặn (403/404 không lộ dữ liệu)
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect([403, 404]).toContain(getRes.status);
    expect(getRes.body.data).toBeUndefined();
  });

  // =========================================================================
  // 3. TÀI XẾ CHỈ THAO TÁC ĐƠN MÌNH NHẬN (403 Forbidden)
  // =========================================================================
  it('Tài xế 2 không được đổi trạng thái đơn do Tài xế 1 đã nhận giao', async () => {
    // Tạo đơn và chuyển trạng thái qua các bước chuẩn: PENDING -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP
    const orderId = await placeOrder(customer1Token);

    // Quán xác nhận đơn
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'CONFIRMED' });

    // Quán chuyển sang đang chế biến
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'PREPARING' });

    // Quán chuyển sang đã sẵn sàng
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'READY_FOR_PICKUP' });

    // Tài xế 1 nhận đơn
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`);
    expect(acceptRes.status).toBe(201);

    // Tài xế 2 cố tình thao tác đổi trạng thái đơn sang PICKED_UP
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({ status: 'PICKED_UP' });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.message || updateRes.body.error).toContain('Bạn không có quyền cập nhật trạng thái này');
  });

  // =========================================================================
  // 4. KHÁCH CHỈ ĐƯỢC HUỶ KHI CHỜ XÁC NHẬN (PENDING) (403/400)
  // =========================================================================
  it('Khách huỷ đơn thành công khi đơn đang PENDING', async () => {
    const orderId = await placeOrder(customer1Token);

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ status: 'CANCELLED', cancelReason: 'CUSTOMER_CHANGED_MIND' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  it('Khách bị từ chối huỷ khi quán đã CONFIRMED đơn hàng', async () => {
    const orderId = await placeOrder(customer1Token);

    // Quán xác nhận đơn
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'CONFIRMED' });

    // Khách cố gắng huỷ đơn
    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ status: 'CANCELLED', cancelReason: 'CUSTOMER_CHANGED_MIND' });

    expect(cancelRes.status).toBe(403);
    expect(cancelRes.body.message || cancelRes.body.error).toContain('Bạn không có quyền cập nhật trạng thái này');
  });

  // =========================================================================
  // 5. SỬA ĐỊA CHỈ: PATCH /users/me/addresses/:id BẢO VỆ CHÍNH CHỦ
  // =========================================================================
  it('Khách 2 không được phép sửa địa chỉ của Khách 1', async () => {
    const addr1 = await prisma.address.findFirst({ where: { userId: customer1Id } });
    expect(addr1).toBeDefined();

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/users/me/addresses/${addr1!.id}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ label: 'Nhà bị sửa trộm' });

    expect(patchRes.status).toBe(404);
  });
});
