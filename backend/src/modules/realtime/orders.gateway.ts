import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { canViewOrder, OrderParticipants } from '../orders/order-access';
import { PrismaService } from '../prisma/prisma.service';

export const rooms = {
  user: (id: string) => `user_${id}`,
  order: (id: string) => `order_${id}`,
  drivers: 'drivers',
};

type Ack = { ok: true } | { ok: false; error: string };

export interface OrderEventPayload {
  id: string;
  status: string;
  paymentStatus: string;
  driverId: string | null;
  updatedAt: Date;
}

/**
 * Socket.IO gateway.
 * Client kết nối kèm access token: io(URL, { auth: { token } }).
 * - Tự động join `user_<id>` (và `drivers` nếu là tài xế).
 * - Emit `order:join` { orderId } để theo dõi 1 đơn -> join `order_<id>` sau khi kiểm tra quyền.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!raw) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(raw, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
      const user: AuthUser = { id: payload.sub, email: payload.email, role: payload.role };
      client.data.user = user;

      await client.join(rooms.user(user.id));
      if (user.role === 'DRIVER') await client.join(rooms.drivers);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('order:join')
  async joinOrder(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId?: string }): Promise<Ack> {
    const user = client.data.user as AuthUser | undefined;
    if (!user || typeof body?.orderId !== 'string') return { ok: false, error: 'Bad request' };

    const order = await this.findParticipants(body.orderId);
    if (!order || !canViewOrder(order, user)) return { ok: false, error: 'Forbidden' };

    await client.join(rooms.order(body.orderId));
    return { ok: true };
  }

  @SubscribeMessage('order:leave')
  async leaveOrder(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId?: string }): Promise<Ack> {
    if (typeof body?.orderId === 'string') await client.leave(rooms.order(body.orderId));
    return { ok: true };
  }

  /** Tài xế gửi vị trí GPS -> phát cho mọi người đang theo dõi đơn. */
  @SubscribeMessage('driver:location')
  async driverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string; lat?: number; lng?: number },
  ): Promise<Ack> {
    const user = client.data.user as AuthUser | undefined;
    const { orderId, lat, lng } = body ?? {};
    if (
      user?.role !== 'DRIVER' ||
      typeof orderId !== 'string' ||
      typeof lat !== 'number' || lat < -90 || lat > 90 ||
      typeof lng !== 'number' || lng < -180 || lng > 180
    ) {
      return { ok: false, error: 'Bad request' };
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId: user.id, status: { in: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'] } },
      select: { id: true },
    });
    if (!order) return { ok: false, error: 'Forbidden' };

    this.server.to(rooms.order(orderId)).emit('driver:location', { orderId, lat, lng, at: new Date().toISOString() });
    return { ok: true };
  }

  // ------------------- Server-side emitters (gọi từ OrdersService) -------------------

  emitOrderUpdated(event: string, order: OrderParticipants & OrderEventPayload) {
    const targets = [rooms.order(order.id), rooms.user(order.customerId), rooms.user(order.restaurant.ownerId)];
    if (order.driverId) targets.push(rooms.user(order.driverId));
    // Socket.IO tự loại trùng khi 1 socket nằm ở nhiều room
    this.server?.to(targets).emit(event, this.toPayload(order));
  }

  emitOrderAvailable(order: OrderEventPayload) {
    this.server?.to(rooms.drivers).emit('order:available', this.toPayload(order));
  }

  private toPayload(o: OrderEventPayload): OrderEventPayload {
    return { id: o.id, status: o.status, paymentStatus: o.paymentStatus, driverId: o.driverId, updatedAt: o.updatedAt };
  }

  private findParticipants(orderId: string) {
    // Tránh lỗi Postgres khi orderId không phải UUID
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return Promise.resolve(null);
    return this.prisma.order
      .findUnique({
        where: { id: orderId },
        select: { customerId: true, driverId: true, restaurant: { select: { ownerId: true } } },
      })
      .catch((err) => {
        this.logger.warn(`findParticipants failed: ${err}`);
        return null;
      });
  }
}
