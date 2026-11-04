import { RateLimitedException } from '../../common/rate-limit/rate-limit.exception';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { VOUCHER_NOT_FOUND_REASON } from '../vouchers/voucher-rules';
import { OrdersController } from './orders.controller';

describe('OrdersController: giới hạn tần suất', () => {
  let rateLimit: RateLimitService;
  let orderPricing: { quote: jest.Mock };
  let orders: { getCustomerCancelStatus: jest.Mock; create: jest.Mock };
  let controller: OrdersController;

  const dto = (codes: string[]) => ({ restaurantId: 'r1', addressId: 'a1', items: [], voucherCodes: codes }) as never;

  beforeEach(() => {
    rateLimit = new RateLimitService({ get: () => true } as never);
    // Mã bắt đầu bằng "SAI" coi như không tồn tại
    orderPricing = {
      quote: jest.fn((_userId: string, d: { voucherCodes?: string[] }) =>
        Promise.resolve({
          total: 100_000,
          rejectedVouchers: (d.voucherCodes ?? [])
            .filter((c) => c.startsWith('SAI'))
            .map((code) => ({ code, reason: VOUCHER_NOT_FOUND_REASON })),
        }),
      ),
    };
    orders = {
      getCustomerCancelStatus: jest.fn().mockResolvedValue({ restricted: false }),
      create: jest.fn().mockResolvedValue({ id: 'o1' }),
    };
    controller = new OrdersController(orders as never, orderPricing as never, rateLimit);
  });

  it('nhập 8 mã sai khác nhau thì tạm bỏ qua mã, vẫn trả báo giá để khách đặt được', async () => {
    for (let i = 1; i <= 8; i++) await controller.quote('u1', dto([`SAI${i}`]));
    // Nhập lại cùng một mã sai không tính thêm
    await controller.quote('u1', dto(['SAI1']));

    const res = (await controller.quote('u1', dto(['GIAM20']))) as { total: number; rejectedVouchers: { reason: string }[] };
    expect(orderPricing.quote).toHaveBeenLastCalledWith('u1', expect.objectContaining({ voucherCodes: [] }));
    expect(res.total).toBe(100_000);
    expect(res.rejectedVouchers[0].reason).toMatch(/nhập sai mã nhiều lần/);

    // Không nhập mã thì báo giá bình thường
    await controller.quote('u1', dto([]));
    expect(orderPricing.quote).toHaveBeenLastCalledWith('u1', expect.objectContaining({ voucherCodes: [] }));
  });

  it('7 mã sai chưa bị chặn; người khác không bị ảnh hưởng', async () => {
    for (let i = 1; i <= 7; i++) await controller.quote('u1', dto([`SAI${i}`]));
    await controller.quote('u1', dto(['GIAM20']));
    expect(orderPricing.quote).toHaveBeenLastCalledWith('u1', expect.objectContaining({ voucherCodes: ['GIAM20'] }));
    for (let i = 8; i <= 9; i++) await controller.quote('u1', dto([`SAI${i}`]));
    await controller.quote('u2', dto(['GIAM20']));
    expect(orderPricing.quote).toHaveBeenLastCalledWith('u2', expect.objectContaining({ voucherCodes: ['GIAM20'] }));
  });

  it('tạo đơn: tối đa 5 đơn / 10 phút; gửi lại cùng idempotency-key không bị tính thêm', async () => {
    for (let i = 0; i < 3; i++) await controller.create('u1', {} as never, 'same-key');
    for (let i = 0; i < 4; i++) await controller.create('u1', {} as never, `key-${i}`);
    expect(() => controller.create('u1', {} as never, 'key-new')).toThrow(RateLimitedException);
    expect(orders.create).toHaveBeenCalledTimes(7);
  });
});
