import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DistanceSource, Prisma, RestaurantStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { calcDeliveryFeeBreakdown, ceil1000, haversineKm } from '../../common/utils/geo.util';
import { estimateDeliveryWindow } from '../../common/utils/delivery-time';
import { isWithinOpeningHours } from '../../common/utils/opening-hours';
import { MapsService } from '../maps/maps.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, OrderItemInputDto, QuoteOrderDto } from './dto/orders.dto';
import { lineKey, OrderPricingError, priceOrderLine, SelectedOptions } from './order-pricing';

export interface QuotedLine {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string;
  options: SelectedOptions | Record<string, never>;
}

export interface OrderQuoteResponse {
  quoteToken: string;
  expiresAt: string;
  restaurant: { id: string; name: string };
  address: { id: string; addressLine: string };
  lines: QuotedLine[];
  subtotal: number;
  distanceKm: number;
  distanceSource: DistanceSource;
  estimatedMinutes: { min: number; max: number };
  baseDeliveryFee: number;
  peakSurcharge: number;
  deliveryFee: number;
  isPeak: boolean;
  total: number;
  paymentMethod: 'COD';
}

export interface PricedOrderContext {
  quote: OrderQuoteResponse;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  platformCommission: number;
  driverEarning: number;
  estimatedDeliveryAt: Date;
  dbLines: {
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    note?: string;
    options?: Prisma.InputJsonValue;
  }[];
}

type MergedInputLine = {
  menuItemId: string;
  quantity: number;
  note?: string;
  sizeId?: string;
  toppingIds?: string[];
  level?: string;
};

@Injectable()
export class OrderPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly maps: MapsService,
  ) {}

  /** Báo giá tập trung cho màn Checkout (POST /orders/quote) */
  async quote(customerId: string, dto: QuoteOrderDto, now = new Date()): Promise<OrderQuoteResponse> {
    const ctx = await this.computeOrderPricing(customerId, dto, this.prisma, now);
    return ctx.quote;
  }

  /**
   * Kiểm tra quoteToken và tính lại toàn bộ báo giá trong transaction khi đặt đơn (POST /orders):
   * - Sai chữ ký hoặc khác giỏ hàng / địa chỉ / nhà hàng -> 400 BadRequestException.
   * - Hết hạn hoặc tổng tiền / phí giao hàng thay đổi -> 409 ConflictException kèm code QUOTE_CHANGED và quote mới.
   */
  async verifyAndPriceOrder(
    customerId: string,
    dto: CreateOrderDto,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    now = new Date(),
  ): Promise<PricedOrderContext> {
    const merged = this.mergeItems(dto.items);
    const expectedCartHash = this.buildCartHash(customerId, dto.restaurantId, dto.addressId, merged);
    const parsedToken = this.verifyQuoteTokenSignature(customerId, dto.restaurantId, dto.addressId, expectedCartHash, dto.quoteToken);

    const freshCtx = await this.computeOrderPricing(customerId, dto, tx, now);
    const isExpired = now.getTime() > parsedToken.expiresAtMs;
    const isPriceChanged =
      freshCtx.quote.subtotal !== parsedToken.subtotal ||
      freshCtx.quote.deliveryFee !== parsedToken.deliveryFee ||
      freshCtx.quote.total !== parsedToken.total;

    if (isExpired || isPriceChanged) {
      throw new ConflictException({
        message: 'Giá hoặc phí giao hàng đã thay đổi, vui lòng xác nhận lại',
        code: 'QUOTE_CHANGED',
        quote: freshCtx.quote,
      });
    }

    return freshCtx;
  }

  /** Tính toán toàn bộ báo giá từ DB + khoảng cách đường bộ */
  async computeOrderPricing(
    customerId: string,
    dto: QuoteOrderDto,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
    now = new Date(),
  ): Promise<PricedOrderContext> {
    const requested = this.mergeItems(dto.items);
    const menuItemIds = [...new Set([...requested.values()].map((l) => l.menuItemId))];

    const restaurant = await db.restaurant.findUnique({ where: { id: dto.restaurantId } });
    if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new BadRequestException('Nhà hàng hiện chưa hoạt động hoặc đang tạm ngưng');
    }
    if (!restaurant.isOpen) {
      throw new BadRequestException('Nhà hàng hiện đang đóng cửa');
    }
    if (!isWithinOpeningHours(restaurant.openTime, restaurant.closeTime, now)) {
      throw new BadRequestException(
        `Quán chỉ nhận đơn từ ${restaurant.openTime} đến ${restaurant.closeTime}. Vui lòng quay lại sau.`,
      );
    }

    const address = await db.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!address) {
      throw new NotFoundException('Không tìm thấy địa chỉ giao hàng trong sổ địa chỉ');
    }

    // Kiểm tra vùng giao hàng bằng Haversine
    const directKm = haversineKm(
      { lat: restaurant.latitude, lng: restaurant.longitude },
      { lat: address.latitude, lng: address.longitude },
    );
    if (directKm > restaurant.deliveryRadiusKm) {
      throw new BadRequestException(
        `Địa chỉ nằm ngoài bán kính giao hàng của quán (${restaurant.deliveryRadiusKm} km)`,
      );
    }

    // Kiểm tra món ăn thuộc quán và còn bán
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId: restaurant.id,
        isAvailable: true,
        isArchived: false,
      },
      select: { id: true, name: true, price: true, discountPrice: true, options: true },
    });
    if (menuItems.length !== menuItemIds.length) {
      const found = new Set(menuItems.map((m) => m.id));
      throw new BadRequestException({
        message: 'Một số món không tồn tại hoặc đã hết',
        unavailableItemIds: menuItemIds.filter((id) => !found.has(id)),
      });
    }

    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const quotedLines: QuotedLine[] = [];
    const dbLines: PricedOrderContext['dbLines'] = [];

    for (const req of requested.values()) {
      const m = byId.get(req.menuItemId)!;
      let priced: ReturnType<typeof priceOrderLine>;
      try {
        priced = priceOrderLine(m, req);
      } catch (e) {
        if (e instanceof OrderPricingError) throw new BadRequestException(e.message);
        throw e;
      }
      const lineTotal = priced.unitPrice * req.quantity;
      quotedLines.push({
        menuItemId: m.id,
        name: m.name,
        unitPrice: priced.unitPrice,
        quantity: req.quantity,
        lineTotal,
        ...(req.note ? { note: req.note } : {}),
        options: priced.selected ?? {},
      });
      dbLines.push({
        menuItemId: m.id,
        name: m.name,
        unitPrice: priced.unitPrice,
        quantity: req.quantity,
        lineTotal,
        note: req.note,
        options: priced.selected ? (priced.selected as unknown as Prisma.InputJsonValue) : undefined,
      });
    }

    const subtotal = quotedLines.reduce((sum, l) => sum + l.lineTotal, 0);

    // Tính khoảng cách đường bộ từ adapter B1
    const road = await this.maps.getRoadDistance(
      { lat: restaurant.latitude, lng: restaurant.longitude },
      { lat: address.latitude, lng: address.longitude },
    );

    const deliveryCfg = this.config.getOrThrow('delivery');
    const businessCfg = this.config.get('business');
    const feeBreakdown = calcDeliveryFeeBreakdown(road.distanceKm, deliveryCfg, now);

    const total = subtotal + feeBreakdown.deliveryFee;
    const commissionRate = Number(businessCfg?.platformCommissionRate ?? 0.2);
    const platformCommission = ceil1000(feeBreakdown.deliveryFee * commissionRate);
    const driverEarning = Math.max(0, feeBreakdown.deliveryFee - platformCommission);

    // Cùng công thức với trang chủ / chi tiết quán; chỉ dùng thời gian chạy xe khi là tuyến đường thật
    const { min: minMinutes, max: maxMinutes } = estimateDeliveryWindow({
      distanceKm: road.distanceKm,
      roadMinutes: road.source === 'ROAD' ? road.durationMinutes : undefined,
      isPeak: feeBreakdown.isPeak,
    });
    const estimatedDeliveryAt = new Date(now.getTime() + maxMinutes * 60 * 1000);

    const quoteTtlMinutes = Number(businessCfg?.quoteTtlMinutes ?? 10);
    const expiresAtMs = now.getTime() + quoteTtlMinutes * 60 * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();

    const cartHash = this.buildCartHash(customerId, dto.restaurantId, dto.addressId, requested);
    const quoteToken = this.signQuoteToken(
      customerId,
      dto.restaurantId,
      dto.addressId,
      cartHash,
      subtotal,
      feeBreakdown.deliveryFee,
      total,
      expiresAtMs,
    );

    return {
      quote: {
        quoteToken,
        expiresAt,
        restaurant: { id: restaurant.id, name: restaurant.name },
        address: { id: address.id, addressLine: address.addressLine },
        lines: quotedLines,
        subtotal,
        distanceKm: Math.round(road.distanceKm * 100) / 100,
        distanceSource: road.source === 'ROAD' ? DistanceSource.ROAD : DistanceSource.ESTIMATED,
        estimatedMinutes: { min: minMinutes, max: maxMinutes },
        baseDeliveryFee: feeBreakdown.baseDeliveryFee,
        peakSurcharge: feeBreakdown.peakSurcharge,
        deliveryFee: feeBreakdown.deliveryFee,
        isPeak: feeBreakdown.isPeak,
        total,
        paymentMethod: 'COD',
      },
      deliveryAddress: address.addressLine,
      deliveryLat: address.latitude,
      deliveryLng: address.longitude,
      platformCommission,
      driverEarning,
      estimatedDeliveryAt,
      dbLines,
    };
  }

  /** Gộp các dòng cùng món và cùng tuỳ chọn, kiểm tra giới hạn 50 phần/món */
  mergeItems(items: OrderItemInputDto[]): Map<string, MergedInputLine> {
    const map = new Map<string, MergedInputLine>();
    const perItem = new Map<string, number>();
    for (const it of items) {
      const key = lineKey(it.menuItemId, it);
      const prev = map.get(key);
      if (prev) {
        prev.quantity += it.quantity;
        if (it.note) prev.note = [prev.note, it.note].filter(Boolean).join('; ');
      } else {
        map.set(key, {
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          note: it.note,
          sizeId: it.sizeId,
          toppingIds: it.toppingIds ? [...it.toppingIds].sort() : undefined,
          level: it.level,
        });
      }
      perItem.set(it.menuItemId, (perItem.get(it.menuItemId) ?? 0) + it.quantity);
    }
    for (const [, total] of perItem) {
      if (total > 50) throw new BadRequestException('Số lượng mỗi món tối đa là 50');
    }
    return map;
  }

  private getQuoteSecret(): string {
    return (
      this.config.get<string>('business.quoteSecret') ||
      this.config.get<string>('QUOTE_SECRET') ||
      'dev-quote-secret-change-in-production-32chars!'
    );
  }

  /** Chuỗi chuẩn hoá đại diện cho giỏ hàng đã sắp xếp + người đặt + quán + địa chỉ */
  private buildCartHash(
    customerId: string,
    restaurantId: string,
    addressId: string,
    merged: Map<string, MergedInputLine>,
  ): string {
    const sortedLines = [...merged.entries()]
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .map(([k, v]) => `${k}|${v.quantity}`)
      .join(';');
    const canonical = `${customerId}|${restaurantId}|${addressId}|${sortedLines}`;
    return createHmac('sha256', this.getQuoteSecret()).update(canonical).digest('hex').slice(0, 32);
  }

  private signQuoteToken(
    customerId: string,
    restaurantId: string,
    addressId: string,
    cartHash: string,
    subtotal: number,
    deliveryFee: number,
    total: number,
    expiresAtMs: number,
  ): string {
    const payload = [
      customerId,
      restaurantId,
      addressId,
      cartHash,
      String(subtotal),
      String(deliveryFee),
      String(total),
      String(expiresAtMs),
    ].join('|');
    const sig = createHmac('sha256', this.getQuoteSecret()).update(payload).digest('hex');
    return `${expiresAtMs}.${subtotal}.${deliveryFee}.${total}.${cartHash}.${sig}`;
  }

  private verifyQuoteTokenSignature(
    customerId: string,
    restaurantId: string,
    addressId: string,
    expectedCartHash: string,
    quoteToken: string,
  ): { expiresAtMs: number; subtotal: number; deliveryFee: number; total: number } {
    const parts = (quoteToken || '').trim().split('.');
    if (parts.length !== 6) {
      throw new BadRequestException('Mã báo giá (quoteToken) không hợp lệ');
    }
    const [expiresAtStr, subtotalStr, deliveryFeeStr, totalStr, tokenCartHash, tokenSig] = parts;
    const expiresAtMs = Number(expiresAtStr);
    const subtotal = Number(subtotalStr);
    const deliveryFee = Number(deliveryFeeStr);
    const total = Number(totalStr);

    if (
      !Number.isFinite(expiresAtMs) ||
      !Number.isFinite(subtotal) ||
      !Number.isFinite(deliveryFee) ||
      !Number.isFinite(total) ||
      !tokenCartHash ||
      !tokenSig
    ) {
      throw new BadRequestException('Mã báo giá (quoteToken) không đúng định dạng');
    }

    const payload = [
      customerId,
      restaurantId,
      addressId,
      tokenCartHash,
      subtotalStr,
      deliveryFeeStr,
      totalStr,
      expiresAtStr,
    ].join('|');
    const expectedSig = createHmac('sha256', this.getQuoteSecret()).update(payload).digest('hex');

    const sigBuf = Buffer.from(tokenSig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new BadRequestException('Chữ ký mã báo giá (quoteToken) không hợp lệ');
    }

    if (tokenCartHash !== expectedCartHash) {
      throw new BadRequestException('Giỏ hàng hoặc địa chỉ giao hàng không khớp với báo giá');
    }

    return { expiresAtMs, subtotal, deliveryFee, total };
  }
}
