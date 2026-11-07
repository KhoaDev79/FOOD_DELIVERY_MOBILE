import { collectUnansweredQuestions, InsightMessage, lastDaysVN, normalizeQuestion, ratio } from './bot-insights.util';

const at = (min: number) => new Date(Date.UTC(2026, 10, 5, 3, min));
const msg = (conv: string, role: string, content: string, min: number, extra: Partial<InsightMessage> = {}): InsightMessage => ({
  conversationId: conv,
  role,
  content,
  createdAt: at(min),
  feedback: null,
  unresolved: false,
  ...extra,
});

describe('bot-insights.util', () => {
  it('normalizeQuestion: bỏ dấu, ký tự đặc biệt, gộp khoảng trắng', () => {
    expect(normalizeQuestion('  Đơn của tôi ĐÂU rồi???  ')).toBe('don cua toi dau roi');
  });

  it('lấy đúng câu hỏi ngay trước câu trả lời "chưa giải quyết" hoặc bị 👎, gộp câu giống nhau', () => {
    const messages = [
      msg('c1', 'user', 'Đổi số điện thoại thế nào?', 1),
      msg('c1', 'assistant', 'Mình chưa rõ...', 2, { unresolved: true }),
      msg('c1', 'user', 'cảm ơn', 3),
      msg('c1', 'assistant', 'Không có gì!', 4, { feedback: 'HELPFUL' }),
      msg('c2', 'user', 'đổi số điện thoại thế nào', 10),
      msg('c2', 'assistant', 'Bạn vào...', 11, { feedback: 'UNHELPFUL' }),
      msg('c3', 'user', 'Phí ship bao nhiêu?', 20),
      msg('c3', 'assistant', 'Phí ship...', 21, { feedback: 'UNHELPFUL' }),
    ];
    const res = collectUnansweredQuestions(messages);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ count: 2, question: 'đổi số điện thoại thế nào' });
    expect(res[0].reasons.sort()).toEqual(['UNHELPFUL', 'UNRESOLVED']);
    expect(res[1]).toMatchObject({ count: 1, question: 'Phí ship bao nhiêu?', reasons: ['UNHELPFUL'] });
  });

  it('bỏ qua câu quá ngắn và câu trả lời không có câu hỏi phía trước; thứ tự tin trong DB không quan trọng', () => {
    const res = collectUnansweredQuestions([
      msg('c1', 'assistant', 'Chào bạn', 0, { unresolved: true }),
      msg('c1', 'assistant', '...', 6, { unresolved: true }),
      msg('c1', 'user', 'ok', 5),
    ]);
    expect(res).toEqual([]);
  });

  it('ratio: mẫu số 0 trả null; làm tròn 3 chữ số', () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 3)).toBe(0.333);
  });

  it('lastDaysVN: đủ số ngày, ngày cuối là hôm nay theo giờ VN', () => {
    const days = lastDaysVN(7, new Date('2026-11-05T18:30:00Z')); // 01:30 ngày 06/11 giờ VN
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-11-06');
    expect(days[0]).toBe('2026-10-31');
  });
});
