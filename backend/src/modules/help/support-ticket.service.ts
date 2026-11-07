import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  SupportMessageRole,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompensateTicketDto } from '../vouchers/dto/vouchers.dto';
import { VouchersService } from '../vouchers/vouchers.service';
import {
  CreateSupportTicketDto,
  CreateTicketMessageDto,
  ListTicketsQueryDto,
  SubmitCsatDto,
  UpdateTicketStatusDto,
} from './dto/support-ticket.dto';
import {
  decideResolution,
  DEFAULT_RESOLUTION_CONFIG,
  IssueInput,
  IssueType,
  OrderInput,
} from './ticket-resolution.util';

function generateTicketCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `HT-${rand}`;
}

@Injectable()
export class SupportTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly vouchers: VouchersService,
    private readonly config: ConfigService,
  ) {}

  /** Bồi thường tự động bằng voucher: bật mặc định, tắt bằng SUPPORT_AUTO_COMPENSATION=false */
  private get autoCompensationEnabled(): boolean {
    return String(this.config.get('SUPPORT_AUTO_COMPENSATION') ?? 'true').toLowerCase() !== 'false';
  }

  /**
   * Tạo phiếu hỗ trợ mới (ĐỢT B):
   * - Hỗ trợ theo đơn hàng hoặc hỗ trợ chung
   * - Tự động chạy cây quyết định (decideResolution) để bồi thường hoặc phân loại ưu tiên
   */
  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    let orderInput: OrderInput | null = null;
    let orderRecord: any = null;

    if (dto.orderId) {
      orderRecord = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          items: true,
          restaurant: { select: { id: true, name: true, imageUrl: true } },
        },
      });

      if (!orderRecord) {
        throw new NotFoundException('Không tìm thấy đơn hàng cần khiếu nại');
      }

      if (orderRecord.customerId !== userId) {
        throw new ForbiddenException('Bạn chỉ có thể khiếu nại đơn hàng của chính mình');
      }

      orderInput = {
        id: orderRecord.id,
        code: orderRecord.id.slice(0, 8).toUpperCase(),
        status: orderRecord.status,
        total: orderRecord.total,
        paymentMethod: orderRecord.paymentMethod,
        createdAt: orderRecord.createdAt,
        estimatedDeliveryAt: orderRecord.estimatedDeliveryAt,
        deliveredAt: orderRecord.status === 'DELIVERED' ? orderRecord.updatedAt : null,
      };
    }

    // Lịch sử khiếu nại & uy tín của khách
    const completedOrdersCount = await this.prisma.order.count({
      where: { customerId: userId, status: 'DELIVERED' },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const complaintsCountLast30Days = await this.prisma.supportTicket.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const lastAutoCompensatedTicket = await this.prisma.supportTicket.findFirst({
      where: {
        userId,
        resolution: {
          path: ['decision'],
          equals: 'AUTO_COMPENSATE',
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const issue: IssueInput = {
      type: (dto.issueType as IssueType) || 'GENERAL_SUPPORT',
      description: dto.description,
      affectedItems: dto.affectedItems,
      attachmentsCount: dto.attachments?.length || 0,
    };

    const resolutionResult = decideResolution(
      issue,
      orderInput,
      {
        completedOrdersCount,
        complaintsCountLast30Days,
        lastAutoCompensatedAt: lastAutoCompensatedTicket?.createdAt,
      },
      { ...DEFAULT_RESOLUTION_CONFIG, autoCompensationEnabled: this.autoCompensationEnabled },
    );

    // Tạo mã code độc nhất dạng HT-XXXX
    let code = generateTicketCode();
    let exists = await this.prisma.supportTicket.findUnique({ where: { code } });
    let attempts = 0;
    while (exists && attempts < 5) {
      code = generateTicketCode();
      exists = await this.prisma.supportTicket.findUnique({ where: { code } });
      attempts++;
    }

    const initialStatus =
      resolutionResult.decision === 'AUTO_COMPENSATE'
        ? SupportTicketStatus.RESOLVED
        : SupportTicketStatus.NEW;

    const resolutionJson: Record<string, unknown> = {
      decision: resolutionResult.decision,
      suggestedAction: resolutionResult.suggestedAction,
      reason: resolutionResult.reason,
      compensationAmount: resolutionResult.compensationAmount || null,
      compensationType: resolutionResult.compensationType || null,
    };
    const autoVoucher =
      resolutionResult.decision === 'AUTO_COMPENSATE' &&
      resolutionResult.compensationType === 'VOUCHER' &&
      (resolutionResult.compensationAmount ?? 0) > 0;

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Phát voucher cá nhân thật trước khi báo cho khách là đã bồi thường
      let voucherCode: string | null = null;
      if (autoVoucher) {
        const voucher = await this.vouchers.createCompensation(tx, {
          userId,
          amount: resolutionResult.compensationAmount!,
          actorId: null,
          ticketCode: code,
        });
        voucherCode = voucher.code;
        resolutionJson.voucherId = voucher.id;
        resolutionJson.voucherCode = voucher.code;
      }

      const created = await tx.supportTicket.create({
        data: {
          code,
          userId,
          orderId: dto.orderId || null,
          category: dto.category,
          subject: dto.subject,
          status: initialStatus,
          priority: resolutionResult.priority,
          resolution: resolutionJson as Prisma.InputJsonValue,
          resolvedAt: initialStatus === SupportTicketStatus.RESOLVED ? new Date() : null,
        },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              total: true,
              restaurant: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      });

      // Tạo tin nhắn đầu tiên từ khách
      await tx.supportMessage.create({
        data: {
          ticketId: created.id,
          senderId: userId,
          senderRole: SupportMessageRole.CUSTOMER,
          content: dto.description,
          attachments: dto.attachments || [],
        },
      });

      // Nếu được bồi thường tự động -> gửi thêm tin nhắn hệ thống thông báo kết quả
      if (resolutionResult.decision === 'AUTO_COMPENSATE') {
        await tx.supportMessage.create({
          data: {
            ticketId: created.id,
            senderId: null,
            senderRole: SupportMessageRole.SYSTEM,
            content: voucherCode
              ? `Hệ thống đã tặng bạn voucher ${voucherCode} trị giá ${resolutionResult.compensationAmount!.toLocaleString('vi-VN')} ₫ (dùng 1 lần, hạn 30 ngày, xem trong Ví voucher). Lý do: ${resolutionResult.reason}.`
              : `Hệ thống đã tự động xử lý yêu cầu: ${resolutionResult.suggestedAction}. Lý do: ${resolutionResult.reason}.`,
            attachments: [],
          },
        });
      }

      return created;
    });

    return ticket;
  }

  /**
   * Danh sách phiếu hỗ trợ của khách (Đang xử lý / Đã đóng)
   */
  async getMyTickets(userId: string, query: ListTicketsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    } else if (query.statusGroup === 'open') {
      where.status = {
        in: [
          SupportTicketStatus.NEW,
          SupportTicketStatus.IN_PROGRESS,
          SupportTicketStatus.WAITING_CUSTOMER,
        ],
      };
    } else if (query.statusGroup === 'closed') {
      where.status = {
        in: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              total: true,
              restaurant: { select: { id: true, name: true, imageUrl: true } },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, createdAt: true, senderRole: true },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        code: t.code,
        category: t.category,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        order: t.order,
        lastMessage: t.messages[0] || null,
        csatScore: t.csatScore,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Chi tiết phiếu hỗ trợ kèm toàn bộ lịch sử tin nhắn
   */
  async getTicketDetail(userId: string, userRole: Role, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            total: true,
            paymentMethod: true,
            createdAt: true,
            updatedAt: true,
            restaurant: { select: { id: true, name: true, imageUrl: true, phone: true } },
            items: {
              select: {
                id: true,
                name: true,
                unitPrice: true,
                quantity: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    }

    if (userRole !== Role.ADMIN && ticket.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập phiếu hỗ trợ này');
    }

    return ticket;
  }

  /**
   * Gửi tin nhắn trao đổi trong phiếu hỗ trợ
   */
  async addMessage(
    userId: string,
    userRole: Role,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    }

    if (userRole !== Role.ADMIN && ticket.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền trả lời phiếu hỗ trợ này');
    }

    if (ticket.status === SupportTicketStatus.CLOSED) {
      throw new BadRequestException('Phiếu hỗ trợ đã đóng, không thể gửi thêm phản hồi');
    }

    const isAdmin = userRole === Role.ADMIN;
    const senderRole = isAdmin ? SupportMessageRole.ADMIN : SupportMessageRole.CUSTOMER;

    // Cập nhật trạng thái phiếu hỗ trợ dựa trên người gửi
    let newStatus: SupportTicketStatus | undefined;
    let firstResponseAt = ticket.firstResponseAt;

    if (isAdmin) {
      newStatus = SupportTicketStatus.WAITING_CUSTOMER;
      if (!firstResponseAt) {
        firstResponseAt = new Date();
      }
    } else {
      if (
        ticket.status === SupportTicketStatus.WAITING_CUSTOMER ||
        ticket.status === SupportTicketStatus.NEW
      ) {
        newStatus = SupportTicketStatus.IN_PROGRESS;
      }
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId,
          senderId: userId,
          senderRole,
          content: dto.content,
          attachments: dto.attachments || [],
        },
        include: {
          sender: {
            select: { id: true, fullName: true, avatarUrl: true, role: true },
          },
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          ...(newStatus ? { status: newStatus } : {}),
          firstResponseAt,
          updatedAt: new Date(),
        },
      }),
    ]);

    // Gửi thông báo cho đối phương
    if (isAdmin) {
      void this.notifications.sendToUsers([ticket.userId], {
        title: `Phản hồi phiếu hỗ trợ #${ticket.code}`,
        body: dto.content.length > 80 ? `${dto.content.slice(0, 80)}...` : dto.content,
        data: { type: 'support_ticket', ticketId: ticket.id, ticketCode: ticket.code },
      });
    }

    return message;
  }

  /**
   * Đánh dấu phiếu hỗ trợ đã giải quyết (RESOLVED)
   */
  async resolveTicket(userId: string, userRole: Role, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    }

    if (userRole !== Role.ADMIN && ticket.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền cập nhật phiếu này');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      await tx.supportMessage.create({
        data: {
          ticketId,
          senderId: userId,
          senderRole: SupportMessageRole.SYSTEM,
          content:
            userRole === Role.ADMIN
              ? 'Nhân viên CSKH đã đánh dấu vấn đề được giải quyết.'
              : 'Khách hàng đã xác nhận vấn đề được giải quyết.',
          attachments: [],
        },
      });

      return res;
    });

    if (userRole === Role.ADMIN) {
      void this.notifications.sendToUsers([ticket.userId], {
        title: `Phiếu hỗ trợ #${ticket.code} đã giải quyết`,
        body: 'Vấn đề của bạn đã được giải quyết. Vui lòng đánh giá chất lượng phục vụ nhé!',
        data: { type: 'support_ticket', ticketId: ticket.id, ticketCode: ticket.code },
      });
    }

    return updated;
  }

  /**
   * Đánh giá mức độ hài lòng CSAT (1-5 sao)
   */
  async submitCsat(userId: string, ticketId: string, dto: SubmitCsatDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể đánh giá phiếu của mình');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        csatScore: dto.csatScore,
        csatComment: dto.csatComment || null,
        status: SupportTicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  /**
   * Đếm số phiếu đang mở của khách hàng
   */
  async countOpenTickets(userId: string): Promise<number> {
    return this.prisma.supportTicket.count({
      where: {
        userId,
        status: {
          in: [
            SupportTicketStatus.NEW,
            SupportTicketStatus.IN_PROGRESS,
            SupportTicketStatus.WAITING_CUSTOMER,
          ],
        },
      },
    });
  }

  // ---------------- ADMIN ENDPOINTS (ĐỢT D) ----------------

  async adminListTickets(query: ListTicketsQueryDto & { q?: string; priority?: SupportTicketPriority }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
          order: {
            select: {
              id: true,
              total: true,
              status: true,
              restaurant: { select: { id: true, name: true } },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, createdAt: true, senderRole: true },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminUpdateTicketStatus(ticketId: string, adminId: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    }

    const closedAt =
      dto.status === SupportTicketStatus.CLOSED && !ticket.closedAt ? new Date() : ticket.closedAt;
    const resolvedAt =
      dto.status === SupportTicketStatus.RESOLVED && !ticket.resolvedAt ? new Date() : ticket.resolvedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: dto.status,
          ...(dto.priority ? { priority: dto.priority } : {}),
          resolvedAt,
          closedAt,
        },
      });

      if (dto.adminNote) {
        await tx.supportMessage.create({
          data: {
            ticketId,
            senderId: adminId,
            senderRole: SupportMessageRole.ADMIN,
            content: `[Ghi chú nội bộ / Cập nhật trạng thái]: ${dto.adminNote}`,
            attachments: [],
          },
        });
      }

      return res;
    });

    void this.notifications.sendToUsers([ticket.userId], {
      title: `Phiếu hỗ trợ #${ticket.code} cập nhật`,
      body: `Trạng thái mới: ${dto.status}`,
      data: { type: 'support_ticket', ticketId: ticket.id, ticketCode: ticket.code, status: dto.status },
    });

    return updated;
  }

  /**
   * Admin tặng voucher bồi thường cho khách của phiếu (mỗi phiếu tối đa một lần).
   * Phiếu chuyển sang Đã giải quyết, khách nhận thông báo kèm mã.
   */
  async adminCompensate(ticketId: string, adminId: string, dto: CompensateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Không tìm thấy phiếu hỗ trợ');
    const resolution = (ticket.resolution as Record<string, unknown> | null) ?? {};
    if (resolution.voucherCode) {
      throw new ConflictException(`Phiếu đã được bồi thường bằng voucher ${String(resolution.voucherCode)}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const voucher = await this.vouchers.createCompensation(tx, {
        userId: ticket.userId,
        amount: dto.amount,
        actorId: adminId,
        ticketCode: ticket.code,
      });
      await tx.supportMessage.create({
        data: {
          ticketId,
          senderId: adminId,
          senderRole: SupportMessageRole.ADMIN,
          content:
            `ZomZom xin lỗi vì trải nghiệm chưa tốt. Chúng mình đã tặng bạn voucher ${voucher.code} trị giá ` +
            `${dto.amount.toLocaleString('vi-VN')} ₫ (dùng 1 lần, hạn 30 ngày, xem trong Ví voucher).` +
            (dto.note ? ` ${dto.note}` : ''),
          attachments: [],
        },
      });
      return tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.RESOLVED,
          resolvedAt: ticket.resolvedAt ?? new Date(),
          firstResponseAt: ticket.firstResponseAt ?? new Date(),
          resolution: {
            ...resolution,
            decision: resolution.decision ?? 'NEEDS_REVIEW',
            compensationType: 'VOUCHER',
            compensationAmount: dto.amount,
            voucherId: voucher.id,
            voucherCode: voucher.code,
            compensatedBy: adminId,
          } as Prisma.InputJsonValue,
        },
      });
    });

    void this.notifications.sendToUsers([ticket.userId], {
      title: 'Bạn nhận được voucher bồi thường',
      body: `Yêu cầu #${ticket.code} đã được giải quyết: voucher ${dto.amount.toLocaleString('vi-VN')} ₫ đã vào Ví voucher.`,
      data: { type: 'support_ticket', ticketId: ticket.id, ticketCode: ticket.code, status: 'RESOLVED' },
    });
    return updated;
  }

  /**
   * Thống kê hiệu suất hỗ trợ (ĐỢT D)
   */
  async getAdminSupportStats() {
    const [totalTickets, openTickets, resolvedTickets, avgCsatData, ticketsByCategory] =
      await Promise.all([
        this.prisma.supportTicket.count(),
        this.prisma.supportTicket.count({
          where: {
            status: {
              in: [
                SupportTicketStatus.NEW,
                SupportTicketStatus.IN_PROGRESS,
                SupportTicketStatus.WAITING_CUSTOMER,
              ],
            },
          },
        }),
        this.prisma.supportTicket.count({
          where: { status: { in: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] } },
        }),
        this.prisma.supportTicket.aggregate({
          _avg: { csatScore: true },
          _count: { csatScore: true },
          where: { csatScore: { not: null } },
        }),
        this.prisma.supportTicket.groupBy({
          by: ['category'],
          _count: { id: true },
        }),
      ]);

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      csat: {
        averageScore: Number(avgCsatData._avg.csatScore?.toFixed(2) || 5.0),
        ratedCount: avgCsatData._count.csatScore,
      },
      byCategory: ticketsByCategory.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    };
  }

  /**
   * Cron: Tự động đóng các phiếu WAITING_CUSTOMER quá 72 giờ không có tin mới
   */
  async autoCloseStaleTickets(): Promise<number> {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const staleTickets = await this.prisma.supportTicket.findMany({
      where: {
        status: SupportTicketStatus.WAITING_CUSTOMER,
        updatedAt: { lte: seventyTwoHoursAgo },
      },
      select: { id: true, code: true, userId: true },
    });

    if (!staleTickets.length) return 0;

    await this.prisma.supportTicket.updateMany({
      where: { id: { in: staleTickets.map((t) => t.id) } },
      data: {
        status: SupportTicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return staleTickets.length;
  }
}
