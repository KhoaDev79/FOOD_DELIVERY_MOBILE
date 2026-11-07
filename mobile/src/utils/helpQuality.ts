import type { HelpArticle } from '../types/api';

/** Đủ số lượt đánh giá thì tỉ lệ 👍 mới có ý nghĩa. */
export const MIN_VOTES = 3;
/** Dưới mức này thì gợi ý admin viết lại bài. */
export const REWRITE_BELOW = 0.6;

export interface ArticleQuality {
  votes: number;
  /** 0..1, null khi chưa có lượt đánh giá nào */
  helpfulRate: number | null;
  needsRewrite: boolean;
  /** Bài được đọc nhiều mà gần như không ai đánh giá: chưa đủ dữ liệu */
  level: 'good' | 'ok' | 'bad' | 'unknown';
}

export function articleQuality(a: Pick<HelpArticle, 'helpfulCount' | 'notHelpfulCount'>): ArticleQuality {
  const votes = a.helpfulCount + a.notHelpfulCount;
  const helpfulRate = votes > 0 ? a.helpfulCount / votes : null;
  const enough = votes >= MIN_VOTES;
  const needsRewrite = enough && helpfulRate !== null && helpfulRate < REWRITE_BELOW;
  const level = !enough ? 'unknown' : needsRewrite ? 'bad' : helpfulRate! >= 0.8 ? 'good' : 'ok';
  return { votes, helpfulRate, needsRewrite, level };
}

/** "75%" hoặc "—" khi chưa có dữ liệu. */
export function percent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`;
}

/** Từ khoá gợi ý từ câu hỏi khách: bỏ từ quá ngắn / từ đệm, tối đa 5 từ. */
const STOP = new Set(['cho', 'toi', 'tôi', 'mình', 'minh', 'của', 'cua', 'là', 'la', 'có', 'co', 'không', 'khong', 'sao', 'thì', 'thi', 'được', 'duoc', 'bạn', 'ban', 'và', 'va', 'với', 'voi', 'nào', 'nao', 'gì', 'gi', 'về', 've', 'món', 'ăn']);
export function keywordsFromQuestion(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, 5);
}

/** Thời gian phản hồi dễ đọc: 850 ms / 2,5 giây. */
export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} giây`;
}

/** Tách "**đậm**" và "*nghiêng*" trong một dòng thành các đoạn chữ lồng nhau. */
export function inlineSegments(text: string): { text: string; bold?: boolean; italic?: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : part.startsWith('*') && part.endsWith('*') && part.length > 2
          ? { text: part.slice(1, -1), italic: true }
          : { text: part },
    );
}
