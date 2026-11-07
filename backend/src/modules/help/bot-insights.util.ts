import { foldVietnamese } from '../../common/utils/vietnamese';

/**
 * Thống kê chất lượng Trợ lý tự động (chatbot) cho admin. Hàm thuần để dễ test; service lo đọc DB.
 */

export interface InsightMessage {
  conversationId: string;
  role: string; // user | assistant
  content: string;
  createdAt: Date;
  feedback: string | null; // HELPFUL | UNHELPFUL
  unresolved: boolean;
}

export type UnansweredReason = 'UNRESOLVED' | 'UNHELPFUL';

export interface UnansweredQuestion {
  /** Câu hỏi tiêu biểu (lần hỏi gần nhất) */
  question: string;
  /** Số lần câu hỏi (gần giống nhau) bị bot trả lời không được */
  count: number;
  lastAskedAt: string;
  reasons: UnansweredReason[];
}

/** Gộp câu hỏi gần giống: bỏ dấu, bỏ ký tự đặc biệt, gộp khoảng trắng. */
export function normalizeQuestion(text: string): string {
  return foldVietnamese(text)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Câu hỏi bot chưa trả lời được: câu khách hỏi ngay trước một câu trả lời bị đánh dấu "chưa giải quyết"
 * hoặc bị khách bấm 👎. Gộp các câu giống nhau, xếp theo số lần rồi theo thời gian gần nhất.
 * Đây là gợi ý để admin viết thêm bài FAQ.
 */
export function collectUnansweredQuestions(messages: InsightMessage[], limit = 15): UnansweredQuestion[] {
  const byConversation = new Map<string, InsightMessage[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId) ?? [];
    list.push(m);
    byConversation.set(m.conversationId, list);
  }

  const groups = new Map<string, { question: string; count: number; last: Date; reasons: Set<UnansweredReason> }>();
  for (const list of byConversation.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let lastUser: InsightMessage | null = null;
    for (const m of list) {
      if (m.role === 'user') {
        lastUser = m;
        continue;
      }
      const reason: UnansweredReason | null = m.unresolved ? 'UNRESOLVED' : m.feedback === 'UNHELPFUL' ? 'UNHELPFUL' : null;
      if (!reason || !lastUser) continue;
      const key = normalizeQuestion(lastUser.content);
      if (key.length < 3) continue; // "ok", "?"... không có ích để viết FAQ
      const g = groups.get(key);
      if (g) {
        g.count += 1;
        g.reasons.add(reason);
        if (lastUser.createdAt > g.last) {
          g.last = lastUser.createdAt;
          g.question = lastUser.content;
        }
      } else {
        groups.set(key, { question: lastUser.content, count: 1, last: lastUser.createdAt, reasons: new Set([reason]) });
      }
      lastUser = null; // một câu hỏi chỉ tính một lần
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime())
    .slice(0, limit)
    .map((g) => ({
      question: g.question.slice(0, 300),
      count: g.count,
      lastAskedAt: g.last.toISOString(),
      reasons: [...g.reasons],
    }));
}

/** Tỉ lệ (0..1) làm tròn 3 chữ số; mẫu số 0 thì null để app hiện "—" thay vì 0%. */
export function ratio(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 1000;
}

/** Danh sách ngày (YYYY-MM-DD, giờ VN) từ (hôm nay - days + 1) tới hôm nay, để biểu đồ có đủ ngày kể cả ngày trống. */
export function lastDaysVN(days: number, now = new Date()): string[] {
  const vnToday = new Date(now.getTime() + 7 * 60 * 60_000);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(vnToday.getTime() - i * 24 * 60 * 60_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
