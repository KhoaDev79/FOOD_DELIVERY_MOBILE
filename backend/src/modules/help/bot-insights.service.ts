import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { collectUnansweredQuestions, lastDaysVN, ratio } from './bot-insights.util';

interface MetaShape {
  unresolved?: boolean;
}
const isUnresolved = (meta: unknown) => Boolean((meta as MetaShape | null)?.unresolved);

/** Thống kê và xem lại hội thoại của Trợ lý tự động (chỉ admin). Nội dung đã được che thông tin cá nhân khi lưu. */
@Injectable()
export class BotInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60_000);
    const [conversations, userMessages, botReplies, helpful, unhelpful, handovers, bySource, latency, unresolvedReplies] =
      await Promise.all([
        this.prisma.botConversation.count({ where: { createdAt: { gte: since } } }),
        this.prisma.botMessage.count({ where: { role: 'user', createdAt: { gte: since } } }),
        this.prisma.botMessage.count({ where: { role: 'assistant', createdAt: { gte: since } } }),
        this.prisma.botMessage.count({ where: { role: 'assistant', feedback: 'HELPFUL', createdAt: { gte: since } } }),
        this.prisma.botMessage.count({ where: { role: 'assistant', feedback: 'UNHELPFUL', createdAt: { gte: since } } }),
        this.prisma.supportTicket.count({ where: { category: 'BOT_HANDOVER', createdAt: { gte: since } } }),
        this.prisma.botMessage.groupBy({
          by: ['source'],
          where: { role: 'assistant', createdAt: { gte: since } },
          _count: { _all: true },
        }),
        this.prisma.botMessage.aggregate({
          where: { role: 'assistant', createdAt: { gte: since }, latencyMs: { not: null } },
          _avg: { latencyMs: true },
        }),
        this.prisma.botMessage.count({
          where: { role: 'assistant', createdAt: { gte: since }, meta: { path: ['unresolved'], equals: true } },
        }),
      ]);

    // Số hội thoại / chuyển nhân viên theo ngày (giờ VN) cho biểu đồ
    const [convDaily, handoverDaily] = await Promise.all([
      this.prisma.$queryRaw<{ d: string; n: bigint }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d, COUNT(*) AS n
        FROM bot_conversations WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ d: string; n: bigint }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d, COUNT(*) AS n
        FROM support_tickets WHERE category = 'BOT_HANDOVER' AND "createdAt" >= ${since} GROUP BY 1`,
    ]);
    const convMap = new Map(convDaily.map((r) => [r.d, Number(r.n)]));
    const handMap = new Map(handoverDaily.map((r) => [r.d, Number(r.n)]));
    const daily = lastDaysVN(Math.min(days, 31), now).map((d) => ({
      date: d,
      conversations: convMap.get(d) ?? 0,
      handovers: handMap.get(d) ?? 0,
    }));

    // Câu hỏi bot chưa trả lời được (gợi ý viết thêm FAQ)
    const flagged = await this.prisma.botMessage.findMany({
      where: {
        role: 'assistant',
        createdAt: { gte: since },
        OR: [{ feedback: 'UNHELPFUL' }, { meta: { path: ['unresolved'], equals: true } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { conversationId: true },
    });
    const convIds = [...new Set(flagged.map((f) => f.conversationId))];
    const related = convIds.length
      ? await this.prisma.botMessage.findMany({
          where: { conversationId: { in: convIds }, createdAt: { gte: since } },
          select: { conversationId: true, role: true, content: true, createdAt: true, feedback: true, meta: true },
        })
      : [];
    const unanswered = collectUnansweredQuestions(
      related.map((m) => ({ ...m, unresolved: m.role === 'assistant' && isUnresolved(m.meta) })),
    );

    return {
      days,
      conversations,
      userMessages,
      botReplies,
      helpful,
      unhelpful,
      helpfulRate: ratio(helpful, helpful + unhelpful),
      handovers,
      handoverRate: ratio(handovers, conversations),
      unresolvedReplies,
      unresolvedRate: ratio(unresolvedReplies, botReplies),
      avgLatencyMs: latency._avg.latencyMs ? Math.round(latency._avg.latencyMs) : null,
      bySource: bySource.map((s) => ({ source: s.source ?? 'UNKNOWN', count: s._count._all })),
      daily,
      unanswered,
    };
  }

  /** Danh sách hội thoại mới nhất, có cờ "bị 👎" / "chưa giải quyết" để admin ưu tiên xem. */
  async listConversations(page: number, limit: number, onlyProblems: boolean) {
    const where = onlyProblems
      ? {
          messages: {
            some: {
              role: 'assistant',
              OR: [{ feedback: 'UNHELPFUL' }, { meta: { path: ['unresolved'], equals: true } }],
            },
          },
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.botConversation.count({ where }),
      this.prisma.botConversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          user: { select: { fullName: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true, feedback: true, meta: true, createdAt: true },
          },
        },
      }),
    ]);
    const items = rows.map((c) => {
      const firstQuestion = c.messages.find((m) => m.role === 'user')?.content ?? '';
      return {
        id: c.id,
        createdAt: c.createdAt,
        customerName: c.user.fullName,
        messageCount: c.messages.length,
        lastMessageAt: c.messages[c.messages.length - 1]?.createdAt ?? c.createdAt,
        firstQuestion: firstQuestion.slice(0, 160),
        unhelpfulCount: c.messages.filter((m) => m.feedback === 'UNHELPFUL').length,
        helpfulCount: c.messages.filter((m) => m.feedback === 'HELPFUL').length,
        unresolved: c.messages.some((m) => m.role === 'assistant' && isUnresolved(m.meta)),
      };
    });
    return { items, total, page, limit, hasMore: page * limit < total };
  }

  async conversationMessages(id: string) {
    const conv = await this.prisma.botConversation.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        user: { select: { fullName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, source: true, latencyMs: true, feedback: true, meta: true, createdAt: true },
        },
      },
    });
    if (!conv) throw new NotFoundException('Không tìm thấy hội thoại');
    return {
      id: conv.id,
      createdAt: conv.createdAt,
      customerName: conv.user.fullName,
      messages: conv.messages.map(({ meta, ...m }) => ({ ...m, unresolved: m.role === 'assistant' && isUnresolved(meta) })),
    };
  }
}
