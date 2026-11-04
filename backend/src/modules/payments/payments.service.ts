import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { CreatePaymentUrlDto } from './dto/payments.dto';
import {
  isVnpSuccess,
  verifyVnpSignature,
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

  /** Tạo URL thanh toán VNPay Sandbox — Tạm ngừng trong V4 (COD 100%) */
  async createVnpayUrl(_orderId: string, _user: AuthUser, _req: Request, _dto: CreatePaymentUrlDto) {
    throw new BadRequestException('Thanh toán trực tuyến tạm ngừng');
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

    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
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

      if (!success) return null;

      // Nếu đơn hàng đã bị huỷ trước khi IPN về -> đánh dấu REFUNDED thay vì PAID
      const isCancelled = tx.order.status === 'CANCELLED';
      if (isCancelled) {
        this.logger.warn(
          `VNPay IPN nhận thanh toán thành công cho đơn đã huỷ (${tx.orderId}). Đặt paymentStatus = REFUND_PENDING.`,
        );
      }

      return prisma.order.update({
        where: { id: tx.orderId },
        data: { paymentStatus: isCancelled ? 'REFUND_PENDING' : 'PAID' },
        include: {
          restaurant: { select: { ownerId: true } },
        },
      });
    });

    // Bắn Socket.IO và Push Notification SAU khi transaction đã commit
    if (updatedOrder) {
      this.gateway.emitOrderUpdated('order:payment', {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        driverId: updatedOrder.driverId,
        customerId: updatedOrder.customerId,
        restaurant: { ownerId: updatedOrder.restaurant.ownerId },
        updatedAt: updatedOrder.updatedAt,
      });

      if (updatedOrder.paymentStatus === 'PAID') {
        this.notifications.notifyPaymentSucceeded({
          id: updatedOrder.id,
          customerId: updatedOrder.customerId,
          total: updatedOrder.total,
          restaurant: { ownerId: updatedOrder.restaurant.ownerId },
        });
      }
    }

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

