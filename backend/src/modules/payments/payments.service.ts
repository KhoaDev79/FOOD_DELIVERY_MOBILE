import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentTransactionStatus, Prisma } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { CreatePaymentUrlDto } from './dto/payments.dto';
import {
  buildPaymentUrl,
  formatVnpDate,
  isVnpSuccess,
  verifyVnpSignature,
  VnpParams,
} from './vnpay.util';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: OrdersGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tạo URL thanh toán VNPay Sandbox */
  async createVnpayUrl(orderId: string, user: AuthUser, req: Request, dto: CreatePaymentUrlDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.customerId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không phải chủ đơn hàng');
    }
    if (order.paymentMethod !== 'VNPAY') {
      throw new BadRequestException('Đơn hàng không dùng hình thức thanh toán VNPay');
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Đơn hàng đã được thanh toán trước đó');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã bị hủy');
    }

    const vnpCfg = this.config.getOrThrow('vnpay');
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    // Tạo mã txnRef duy nhất cho mỗi lần nhấn thanh toán
    const txnRef = `${order.id.slice(0, 8)}_${Date.now()}`;
    const createDate = new Date();
    const expireDate = new Date(createDate.getTime() + vnpCfg.expireMinutes * 60 * 1000);

    // Lưu bản ghi giao dịch chờ xử lý
    await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: 'VNPAY',
        txnRef,
        amount: order.total,
        status: PaymentTransactionStatus.PENDING,
      },
    });

    const vnpParams: VnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpCfg.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${order.id.slice(0, 8)}`,
      vnp_OrderType: 'other',
      vnp_Amount: String(order.total * 100), // VNPay tính theo đơn vị hào/xu (nhân 100)
      vnp_ReturnUrl: vnpCfg.returnUrl,
      vnp_IpAddr: ip,
      vnp_CreateDate: formatVnpDate(createDate),
      vnp_ExpireDate: formatVnpDate(expireDate),
    };

    if (dto.bankCode) {
      vnpParams.vnp_BankCode = dto.bankCode;
    }

    const paymentUrl = buildPaymentUrl(vnpCfg.url, vnpParams, vnpCfg.hashSecret);
    return { paymentUrl, txnRef };
  }

  /**
   * Xử lý VNPay IPN (Server-to-Server Webhook).
   * Trả về định dạng { RspCode, Message } theo đúng đặc tả của cổng VNPay.
   */
  async handleIpn(query: Record<string, unknown>) {
    const vnpCfg = this.config.getOrThrow('vnpay');
    const isValid = verifyVnpSignature(query, vnpCfg.hashSecret);
    if (!isValid) {
      this.logger.warn('VNPay IPN: Invalid signature');
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    const txnRef = query.vnp_TxnRef as string;
    const amount = Number(query.vnp_Amount) / 100;
    const responseCode = query.vnp_ResponseCode as string;
    const vnpTxnNo = query.vnp_TransactionNo as string;
    const bankCode = query.vnp_BankCode as string;

    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { txnRef },
      include: { order: { include: { restaurant: true } } },
    });

    if (!tx) {
      return { RspCode: '01', Message: 'Order not found' };
    }
    if (tx.amount !== amount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }
    if (tx.status !== 'PENDING') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const success = isVnpSuccess(query);

    await this.prisma.$transaction(async (prisma) => {
      await prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          responseCode,
          providerTxnNo: vnpTxnNo,
          bankCode,
          rawPayload: query as Prisma.InputJsonValue,
        },
      });

      if (success) {
        const updatedOrder = await prisma.order.update({
          where: { id: tx.orderId },
          data: { paymentStatus: 'PAID' },
          include: {
            restaurant: { select: { ownerId: true } },
          },
        });

        // Bắn Socket.IO realtime
        this.gateway.emitOrderUpdated('order:payment', {
          id: updatedOrder.id,
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus,
          driverId: updatedOrder.driverId,
          customerId: updatedOrder.customerId,
          restaurant: { ownerId: updatedOrder.restaurant.ownerId },
          updatedAt: updatedOrder.updatedAt,
        });

        // Bắn push notification
        this.notifications.notifyPaymentSucceeded({
          id: updatedOrder.id,
          customerId: updatedOrder.customerId,
          total: updatedOrder.total,
          restaurant: { ownerId: updatedOrder.restaurant.ownerId },
        });
      }
    });

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  /**
   * Xử lý VNPay Return URL (khi người dùng kết thúc thanh toán trên trình duyệt).
   * Trả về URL Deep Link để chuyển tiếp vào ứng dụng Mobile.
   */
  handleReturn(query: Record<string, unknown>) {
    const vnpCfg = this.config.getOrThrow('vnpay');
    const isValid = verifyVnpSignature(query, vnpCfg.hashSecret);
    const txnRef = query.vnp_TxnRef as string;
    const orderId = txnRef ? txnRef.split('_')[0] : '';
    const success = isValid && isVnpSuccess(query);

    const redirectUrl = `${vnpCfg.mobileRedirect}?orderId=${orderId}&status=${success ? 'success' : 'failed'}&code=${query.vnp_ResponseCode}`;
    return { redirectUrl, success, orderId };
  }
}

