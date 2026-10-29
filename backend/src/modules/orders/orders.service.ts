import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { calcDeliveryFee, haversineKm } from '../../common/utils/geo.util';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, ListOrdersQueryDto } from './dto/orders.dto';
import { canViewOrder } from './order-access';
import {
  actorMayTransition,
  DRIVER_ACCEPTABLE_STATUSES,
  isValidTransition,
  OrderActor,
} from './order-state-machine';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  restaurant: {
    select: { id: true, name: true, imageUrl: true, address: true, latitude: true, longitude: true, ownerId: true },
  },
  customer: { select: { id: true, fullName: true, phone: true } },
  driver: { select: { id: true, fullName: true, phone: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: OrdersGateway,
    private readonly restaurants: RestaurantsService,
    private readonly notifications: NotificationsService,
  ) {}

  // =========================================================================
  //  ĐẶT ĐƠN — toàn bộ trong 1 transaction, giá luôn lấy từ DB
  // =========================================================================
  async create(customerId: string, dto: CreateOrderDto): Promise<OrderDetail> {
    const location = await this.resolveDeliveryLocation(customerId, dto);
    const requested = this.mergeItems(dto.items);
    const menuItemIds = [...requested.keys()];
    const deliveryCfg = this.config.getOrThrow('delivery');

    const order = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.findUnique({ where: { id: dto.restaurantId } });
      if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');
      if (!restaurant.isOpen) throw new BadRequestException('Nhà hàng hiện đang đóng cửa');

      const distanceKm = haversineKm(
        { lat: restaurant.latitude, lng: restaurant.longitude },
        { lat: location.lat, lng: location.lng },
      );
      if (distanceKm > restaurant.deliveryRadiusKm) {
        throw new BadRequestException(
          `Địa chỉ nằm ngoài bán kính giao hàng của quán (${restaurant.deliveryRadiusKm} km)`,
        );
      }

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          restaurantId: restaurant.id, // chặn trộn món của quán khác
          isAvailable: true,
          isArchived: false,
        },
        select: { id: true, name: true, price: true },
      });
      if (menuItems.length !== menuItemIds.length) {
        const found = new Set(menuItems.map((m) => m.id));
        throw new BadRequestException({
          message: 'Một số món không tồn tại hoặc đã hết',
          unavailableItemIds: menuItemIds.filter((id) => !found.has(id)),
        });
      }

      const lines = menuItems.map((m) => {
        const { quantity, note } = requested.get(m.id)!;
        return { menuItemId: m.id, name: m.name, unitPrice: m.price, quantity, lineTotal: m.price * quantity, note };
      });
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const deliveryFee = calcDeliveryFee(distanceKm, deliveryCfg);

      return tx.order.create({
        data: {
          customerId,
          restaurantId: restaurant.id,
          paymentMethod: dto.paymentMethod,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          distanceKm: Math.round(distanceKm * 100) / 100,
          deliveryAddress: location.address,
          deliveryLat: location.lat,
          deliveryLng: location.lng,
          note: dto.note,
          items: { create: lines },
          statusHistory: { create: { status: 'PENDING', changedBy: customerId } },
        },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    // Chỉ phát sự kiện sau khi transaction đã commit
    this.gateway.emitOrderUpdated('order:created', order);
    this.notifications.notifyOrderCreated(order);
    return order;
  }

  // =========================================================================
  //  CẬP NHẬT TRẠNG THÁI — state machine + optimistic concurrency
  // =========================================================================
  async updateStatus(orderId: string, user: AuthUser, to: OrderStatus): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    const actor = this.resolveActor(order, user);

    if (!isValidTransition(order.status, to)) {
      throw new BadRequestException(`Không thể chuyển đơn từ ${order.status} sang ${to}`);
    }
    if (!actor || !actorMayTransition(actor, order.status, to)) {
      throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái này');
    }
    if (to === 'PICKED_UP' && !order.driverId) {
      throw new BadRequestException('Đơn chưa có tài xế nhận');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // WHERE status = trạng thái vừa đọc => nếu ai đó đã đổi trước, count = 0
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === 'DELIVERED' && order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' as const } : {}),
        },
      });
      if (count === 0) throw new ConflictException('Trạng thái đơn đã thay đổi, vui lòng tải lại');

      await tx.orderStatusHistory.create({ data: { orderId, status: to, changedBy: user.id } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    });

    this.gateway.emitOrderUpdated('order:status', updated);
    if (to === 'CONFIRMED' && !updated.driverId) this.gateway.emitOrderAvailable(updated);
    this.notifications.notifyStatusChanged(updated);
    return updated;
  }

  /** Tài xế nhận đơn — atomic, chỉ 1 tài xế thắng khi tranh chấp. */
  async acceptByDriver(orderId: string, driverId: string): Promise<OrderDetail> {
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES } },
      data: { driverId },
    });
    if (count === 0) {
      const exists = await this.prisma.order.count({ where: { id: orderId } });
      if (!exists) throw new NotFoundException('Không tìm thấy đơn hàng');
      throw new ConflictException('Đơn đã có tài xế khác nhận hoặc không còn khả dụng');
    }
    const order = await this.getOrderOrThrow(orderId);
    this.gateway.emitOrderUpdated('order:driver_assigned', order);
    this.notifications.notifyDriverAssigned(order);
    return order;
  }

  // =========================================================================
  //  TRUY VẤN
  // =========================================================================
  async findOne(orderId: string, user: AuthUser): Promise<OrderDetail> {
    const order = await this.getOrderOrThrow(orderId);
    // Trả 404 thay vì 403 để không lộ sự tồn tại của đơn
    if (!canViewOrder(order, user)) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  findForCustomer(customerId: string, q: ListOrdersQueryDto) {
    return this.paginate({ customerId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async findForRestaurant(restaurantId: string, user: AuthUser, q: ListOrdersQueryDto) {
    await this.restaurants.assertCanManage(restaurantId, user);
    return this.paginate({ restaurantId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  findForDriver(driverId: string, q: ListOrdersQueryDto) {
    return this.paginate({ driverId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  findAvailableForDrivers(q: ListOrdersQueryDto) {
    return this.paginate({ driverId: null, status: { in: DRIVER_ACCEPTABLE_STATUSES } }, q, 'asc');
  }

  // =========================================================================
  //  HELPERS
  // =========================================================================
  private async paginate(where: Prisma.OrderWhereInput, q: ListOrdersQueryDto, order: 'asc' | 'desc' = 'desc') {
    const rows = await this.prisma.order.findMany({
      where,
      include: {
        items: { select: { name: true, quantity: true, unitPrice: true } },
        restaurant: { select: { id: true, name: true, imageUrl: true, address: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { createdAt: order },
      skip: (q.page - 1) * q.limit,
      take: q.limit + 1,
    });
    return { items: rows.slice(0, q.limit), page: q.page, limit: q.limit, hasMore: rows.length > q.limit };
  }

  private async getOrderOrThrow(orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  private resolveActor(order: OrderDetail, user: AuthUser): OrderActor | null {
    if (user.role === 'ADMIN') return 'ADMIN';
    if (user.role === 'RESTAURANT_OWNER' && order.restaurant.ownerId === user.id) return 'OWNER';
    if (user.role === 'DRIVER' && order.driverId === user.id) return 'DRIVER';
    if (user.role === 'CUSTOMER' && order.customerId === user.id) return 'CUSTOMER';
    return null;
  }

  /** Gộp các dòng trùng menuItemId để client không thể né giới hạn số lượng. */
  private mergeItems(items: CreateOrderDto['items']) {
    const map = new Map<string, { quantity: number; note?: string }>();
    for (const it of items) {
      const prev = map.get(it.menuItemId);
      if (prev) {
        prev.quantity += it.quantity;
        if (it.note) prev.note = [prev.note, it.note].filter(Boolean).join('; ');
      } else {
        map.set(it.menuItemId, { quantity: it.quantity, note: it.note });
      }
    }
    for (const [, v] of map) {
      if (v.quantity > 50) throw new BadRequestException('Số lượng mỗi món tối đa là 50');
    }
    return map;
  }

  private async resolveDeliveryLocation(customerId: string, dto: CreateOrderDto) {
    if (dto.addressId) {
      const addr = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId: customerId } });
      if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ giao hàng');
      return { address: addr.addressLine, lat: addr.latitude, lng: addr.longitude };
    }
    if (!dto.deliveryAddress || dto.deliveryLat === undefined || dto.deliveryLng === undefined) {
      throw new BadRequestException('Cần cung cấp addressId hoặc deliveryAddress + deliveryLat + deliveryLng');
    }
    return { address: dto.deliveryAddress, lat: dto.deliveryLat, lng: dto.deliveryLng };
  }
}
