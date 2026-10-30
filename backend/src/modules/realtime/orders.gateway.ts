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
import { LruCache } from '../../common/utils/lru-cache.util';
import { AuthStateService } from '../auth/auth-state.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { canViewOrder, OrderParticipants } from '../orders/order-access';
import { PrismaService } from '../prisma/prisma.service';

export const rooms = {
  user: (id: string) => `user_${id}`,
  order: (id: string) => `order_${id}`,
  drivers: 'drivers',
  admins: 'admins',
};

type Ack = { ok: true } | { ok: false; error: string };

export interface OrderEventPayload {
  id: string;
  status: string;
  paymentStatus: string;
  driverId: string | null;
  updatedAt: Date;
}

const ACTIVE_DRIVER_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'] as const;
const SOCKET_LOCATION_RATE_LIMIT_MS = 2000;
const DB_LOCATION_PERSIST_INTERVAL_MS = 60_000;
const DRIVER_ORDER_CACHE_TTL_MS = 30_000;

const rawCorsOrigins = process.env.CORS_ORIGINS ?? '*';
const gatewayCorsOrigin = rawCorsOrigins === '*' ? '*' : rawCorsOrigins.split(',').map((o) => o.trim());

/**
 * Socket.IO gateway.
 * Client kết nối kèm access token: io(URL, { auth: { token } }).
 * - Tự động join `user_<id>` (và `drivers` nếu là tài xế, `admins` nếu là admin).
 * - Emit `order:join` { orderId } để theo dõi 1 đơn -> join `order_<id>` sau khi kiểm tra quyền.
 */
@WebSocketGateway({ cors: { origin: gatewayCorsOrigin } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrdersGateway.name);
  private readonly driverOrderAuthCache = new LruCache<boolean>(500, DRIVER_ORDER_CACHE_TTL_MS);
  private readonly lastDriverDbPersistAt = new LruCache<number>(1000, DB_LOCATION_PERSIST_INTERVAL_MS * 2);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authState: AuthStateService,
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
      const state = await this.authState.getUserState(payload.sub);
      if (!state || !state.isActive) {
        client.emit('error', { message: 'Tài khoản đã bị khoá' });
        client.disconnect(true);
        return;
      }
      if (state.role !== payload.role) {
        client.emit('error', { message: 'Vai trò đã thay đổi, vui lòng đăng nhập lại' });
        client.disconnect(true);
        return;
      }

      const user: AuthUser = { id: payload.sub, email: payload.email, role: state.role };
      client.data.user = user;

      await client.join(rooms.user(user.id));
      if (user.role === 'DRIVER') {
        await client.join(rooms.drivers);
        const activeOrders = await this.prisma.order.findMany({
          where: {
            driverId: user.id,
            status: { in: [...ACTIVE_DRIVER_ORDER_STATUSES] },
          },
          select: { id: true },
        });
        client.data.activeOrders = new Set<string>(activeOrders.map((o) => o.id));
      }
      if (user.role === 'ADMIN') await client.join(rooms.admins);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  disconnectUser(userId: string) {
    this.server?.in(rooms.user(userId)).disconnectSockets(true);
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

  /**
   * D2: Tài xế gửi vị trí GPS -> phát cho phòng `order_<id>`.
   * - Không truy vấn DB mỗi lần: dùng `client.data.activeOrders` và cache 30s.
   * - Giới hạn tốc độ: tối đa 1 sự kiện / 2 giây mỗi socket.
   * - Mỗi 60 giây ghi `lastLatitude/lastLongitude/lastLocationAt` vào `DriverProfile`.
   */
  @SubscribeMessage('driver:location')
  async driverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      orderId?: string;
      lat?: number;
      lng?: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
    },
  ): Promise<Ack> {
    const user = client.data.user as AuthUser | undefined;
    const { orderId, lat, lng, heading, speed, accuracy } = body ?? {};
    if (
      user?.role !== 'DRIVER' ||
      typeof orderId !== 'string' ||
      typeof lat !== 'number' ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      typeof lng !== 'number' ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      return { ok: false, error: 'Bad request' };
    }

    const now = Date.now();
    const lastEmit = (client.data.lastLocationEmitAt as number | undefined) ?? 0;
    if (now - lastEmit < SOCKET_LOCATION_RATE_LIMIT_MS) {
      return { ok: false, error: 'Rate limit exceeded' };
    }

    const isAuthorized = await this.isDriverAuthorizedForOrder(client, user.id, orderId);
    if (!isAuthorized) {
      return { ok: false, error: 'Forbidden' };
    }

    client.data.lastLocationEmitAt = now;
    const at = new Date(now).toISOString();

    this.server?.to(rooms.order(orderId)).emit('driver:location', {
      orderId,
      lat,
      lng,
      ...(typeof heading === 'number' && Number.isFinite(heading) ? { heading } : {}),
      ...(typeof speed === 'number' && Number.isFinite(speed) ? { speed } : {}),
      ...(typeof accuracy === 'number' && Number.isFinite(accuracy) ? { accuracy } : {}),
      at,
    });

    // Ghi vị trí mới nhất vào DriverProfile mỗi 60 giây
    const lastPersist = this.lastDriverDbPersistAt.get(user.id) ?? 0;
    if (now - lastPersist >= DB_LOCATION_PERSIST_INTERVAL_MS) {
      this.lastDriverDbPersistAt.set(user.id, now);
      void this.prisma.driverProfile
        .updateMany({
          where: { userId: user.id },
          data: {
            lastLatitude: lat,
            lastLongitude: lng,
            lastLocationAt: new Date(now),
          },
        })
        .catch((err) => this.logger.warn(`Failed to persist driver location: ${err}`));
    }

    return { ok: true };
  }

  private async isDriverAuthorizedForOrder(
    client: Socket,
    driverId: string,
    orderId: string,
  ): Promise<boolean> {
    const activeSet = client.data.activeOrders as Set<string> | undefined;
    if (activeSet?.has(orderId)) {
      return true;
    }

    const cacheKey = `${driverId}:${orderId}`;
    const cached = this.driverOrderAuthCache.get(cacheKey);
    if (cached !== undefined) {
      if (cached && activeSet) activeSet.add(orderId);
      return cached;
    }

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      this.driverOrderAuthCache.set(cacheKey, false);
      return false;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        driverId,
        status: { in: [...ACTIVE_DRIVER_ORDER_STATUSES] },
      },
      select: { id: true },
    });

    const ok = Boolean(order);
    this.driverOrderAuthCache.set(cacheKey, ok);
    if (ok) {
      if (!client.data.activeOrders) {
        client.data.activeOrders = new Set<string>();
      }
      (client.data.activeOrders as Set<string>).add(orderId);
    }
    return ok;
  }

  // ------------------- Server-side emitters (gọi từ OrdersService / Cron) -------------------

  emitOrderUpdated(event: string, order: OrderParticipants & OrderEventPayload) {
    // Đồng bộ cache đơn đang giao của tài xế
    const isStillActive = (ACTIVE_DRIVER_ORDER_STATUSES as readonly string[]).includes(order.status);
    if (order.driverId) {
      this.driverOrderAuthCache.set(`${order.driverId}:${order.id}`, isStillActive);
    }

    const targets = [rooms.order(order.id), rooms.user(order.customerId), rooms.user(order.restaurant.ownerId)];
    if (order.driverId) targets.push(rooms.user(order.driverId));
    // Socket.IO tự loại trùng khi 1 socket nằm ở nhiều room
    this.server?.to(targets).emit(event, this.toPayload(order));
  }

  /** Phát đơn mới khả dụng với payload đầy đủ tới từng tài xế hợp lệ trong bán kính (D3) */
  emitOrderAvailableToDriver(driverId: string, fullOrderPayload: unknown) {
    this.server?.to(rooms.user(driverId)).emit('order:available', fullOrderPayload);
  }

  /** Giữ tương thích ngược nếu gọi trực tiếp emitOrderAvailable */
  emitOrderAvailable(order: unknown, targetDriverIds?: string[]) {
    if (targetDriverIds && targetDriverIds.length > 0) {
      this.server?.to(targetDriverIds.map((id) => rooms.user(id))).emit('order:available', order);
      return;
    }
    this.server?.to(rooms.drivers).emit('order:available', order);
  }

  /** Khi một tài xế đã nhận đơn -> thông báo cho các tài xế khác gỡ khỏi danh sách chờ (D3) */
  emitOrderTaken(orderId: string) {
    this.server?.to(rooms.drivers).emit('order:taken', { id: orderId });
  }

  /** Phát cảnh báo đơn ứ đọng tới phòng admins (E1/E4) */
  emitOrderStalled(orderPayload: unknown) {
    this.server?.to(rooms.admins).emit('order:stalled', orderPayload);
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
