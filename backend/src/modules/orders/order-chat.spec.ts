import { AuthUser } from '../../common/decorators/current-user.decorator';
import { canParticipate, canReadChannel, channelRecipients, ChatOrder, senderSideIn } from './order-chat';

const order: ChatOrder = { customerId: 'cus', driverId: 'drv', restaurant: { ownerId: 'own' } };
const user = (id: string, role: AuthUser['role']): AuthUser => ({ id, email: `${id}@x.vn`, role });

const customer = user('cus', 'CUSTOMER');
const owner = user('own', 'RESTAURANT_OWNER');
const driver = user('drv', 'DRIVER');
const admin = user('adm', 'ADMIN');

describe('order-chat: mỗi cuộc trò chuyện chỉ 2 bên', () => {
  it('khách–tài xế: quán không đọc, không gửi được', () => {
    expect(canParticipate(order, customer, 'CUSTOMER_DRIVER')).toBe(true);
    expect(canParticipate(order, driver, 'CUSTOMER_DRIVER')).toBe(true);
    expect(canReadChannel(order, owner, 'CUSTOMER_DRIVER')).toBe(false);
    expect(canParticipate(order, owner, 'CUSTOMER_DRIVER')).toBe(false);
  });

  it('khách–quán: tài xế không đọc, không gửi được', () => {
    expect(canParticipate(order, customer, 'CUSTOMER_RESTAURANT')).toBe(true);
    expect(canParticipate(order, owner, 'CUSTOMER_RESTAURANT')).toBe(true);
    expect(canReadChannel(order, driver, 'CUSTOMER_RESTAURANT')).toBe(false);
  });

  it('quán–tài xế: khách không đọc được', () => {
    expect(canParticipate(order, owner, 'RESTAURANT_DRIVER')).toBe(true);
    expect(canParticipate(order, driver, 'RESTAURANT_DRIVER')).toBe(true);
    expect(canReadChannel(order, customer, 'RESTAURANT_DRIVER')).toBe(false);
  });

  it('người ngoài đơn không vào được kênh nào', () => {
    const stranger = user('x', 'CUSTOMER');
    const otherDriver = user('drv2', 'DRIVER');
    for (const ch of ['CUSTOMER_DRIVER', 'CUSTOMER_RESTAURANT', 'RESTAURANT_DRIVER'] as const) {
      expect(canReadChannel(order, stranger, ch)).toBe(false);
      expect(canReadChannel(order, otherDriver, ch)).toBe(false);
    }
  });

  it('đơn chưa có tài xế: đóng các kênh có tài xế', () => {
    const noDriver: ChatOrder = { ...order, driverId: null };
    expect(canParticipate(noDriver, customer, 'CUSTOMER_DRIVER')).toBe(false);
    expect(canParticipate(noDriver, owner, 'RESTAURANT_DRIVER')).toBe(false);
    expect(canParticipate(noDriver, customer, 'CUSTOMER_RESTAURANT')).toBe(true);
  });

  it('admin chỉ đọc, không gửi', () => {
    expect(canReadChannel(order, admin, 'CUSTOMER_DRIVER')).toBe(true);
    expect(canParticipate(order, admin, 'CUSTOMER_DRIVER')).toBe(false);
  });

  it('người nhận là bên còn lại của kênh, không bao giờ là bên thứ ba', () => {
    expect(channelRecipients(order, 'CUSTOMER_DRIVER', 'cus')).toEqual(['drv']);
    expect(channelRecipients(order, 'CUSTOMER_RESTAURANT', 'cus')).toEqual(['own']);
    expect(channelRecipients(order, 'RESTAURANT_DRIVER', 'drv')).toEqual(['own']);
  });

  it('xác định phía người gửi để đặt tên hiển thị', () => {
    expect(senderSideIn(order, 'CUSTOMER_RESTAURANT', 'own')).toBe('RESTAURANT');
    expect(senderSideIn(order, 'CUSTOMER_DRIVER', 'drv')).toBe('DRIVER');
  });
});
