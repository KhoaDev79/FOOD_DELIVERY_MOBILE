import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { extractOrderCode, faqExcerpt, maskPii, SupportBotService } from './support-bot.service';
import { SupportTicketService } from './support-ticket.service';

const OWN_ORDER = {
  id: 'abcd1234-0000-0000-0000-000000000001',
  status: 'PREPARING',
  total: 80_000,
  paymentMethod: 'COD',
  createdAt: new Date(),
  estimatedDeliveryAt: new Date(Date.now() + 20 * 60_000),
  restaurant: { name: 'Cơm Tấm Ba Ghiền', imageUrl: null },
  items: [{ name: 'Cơm tấm sườn bì', quantity: 1 }],
};

const geminiText = (text: string) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }),
});
const geminiCall = (name: string, args: Record<string, any>) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args }, thoughtSignature: 'sig' }] } }],
  }),
});

describe('SupportBotService', () => {
  let service: SupportBotService;
  let prisma: any;
  let tickets: any;
  let env: Record<string, any>;
  const fetchMock = jest.fn();

  beforeAll(() => {
    (global as any).fetch = fetchMock;
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    env = { SUPPORT_BOT_DAILY_LIMIT: 20, GEMINI_API_KEY: null, GEMINI_MODEL: null };

    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ fullName: 'Trần Minh Khoa' }) },
      botMessage: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'msg-1', createdAt: new Date(), ...data })),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      botConversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'conv-1', userId: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { findMany: jest.fn().mockResolvedValue([OWN_ORDER]) },
      helpArticle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'art-1',
            categoryId: 'cat-1',
            title: 'Cách tính phí ship',
            body: 'Phí ship 15.000 ₫ cho 2 km đầu, 5.000 ₫ mỗi km tiếp theo.',
            keywords: ['phí', 'ship'],
            sortOrder: 1,
            helpfulCount: 10,
            notHelpfulCount: 0,
            viewCount: 50,
            isActive: true,
          },
        ]),
      },
    };
    tickets = { createTicket: jest.fn().mockResolvedValue({ id: 't-1', code: 'HT-AB12' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportBotService,
        { provide: PrismaService, useValue: prisma },
        { provide: SupportTicketService, useValue: tickets },
        { provide: ConfigService, useValue: { get: (k: string, d?: any) => env[k] ?? d } },
      ],
    }).compile();

    service = module.get(SupportBotService);
  });

  describe('tiện ích', () => {
    it('ẩn số điện thoại và email', () => {
      expect(maskPii('SĐT 0912345678 nhé')).toBe('SĐT [SĐT đã ẩn] nhé');
      expect(maskPii('mail user.test@example.com')).toBe('mail [Email đã ẩn]');
    });

    it('tách mã đơn 8 ký tự', () => {
      expect(extractOrderCode('đơn #c9b20489 đâu rồi')).toBe('C9B20489');
      expect(extractOrderCode('đơn của tôi đâu')).toBeUndefined();
    });

    it('rút gọn bài FAQ, bỏ markdown', () => {
      expect(faqExcerpt('### Tiêu đề\n**Đậm** nội dung')).toBe('Đậm nội dung');
    });
  });

  describe('bot kịch bản (chưa có Gemini)', () => {
    it('trả trạng thái đơn kèm thẻ đơn hàng', async () => {
      const res = await service.sendMessage('user-1', { content: 'Đơn của tôi đang ở đâu rồi?' });
      expect(res.source).toBe('SCRIPT');
      expect(res.content).toContain('Cơm Tấm Ba Ghiền');
      expect(res.cards?.[0].type).toBe('ORDER_STATUS');
    });

    it('trả lời phí ship bằng nội dung bài FAQ', async () => {
      const res = await service.sendMessage('user-1', { content: 'Cho mình hỏi phí ship tính sao?' });
      expect(res.content).toContain('15.000 ₫');
      expect(res.cards?.[0].type).toBe('FAQ_ARTICLE');
    });

    it('"huỷ đơn" khi quán đã nhận: giải thích, không cho huỷ ngay', async () => {
      const res = await service.sendMessage('user-1', { content: 'Huỷ đơn giúp mình' });
      expect(res.content).toContain('không tự huỷ được');
      expect(res.cards?.some((c) => c.type === 'START_ISSUE' && c.issueType !== 'CANCEL_REQUEST')).toBe(true);
    });

    it('"không" không bị hiểu nhầm là món bị hỏng', async () => {
      prisma.helpArticle.findMany.mockResolvedValueOnce([]);
      const res = await service.sendMessage('user-1', { content: 'không có gì' });
      expect(res.cards?.some((c) => c.type === 'START_ISSUE')).toBeFalsy();
    });

    it('2 lần liên tiếp không hiểu -> đề nghị gặp nhân viên', async () => {
      prisma.helpArticle.findMany.mockResolvedValue([]);
      prisma.botConversation.findUnique.mockResolvedValue({ id: 'conv-1', userId: 'user-1' });
      prisma.botMessage.findMany.mockResolvedValueOnce([
        { role: 'assistant', content: 'Mình chưa hiểu', meta: { unresolved: true } },
      ]);
      const res = await service.sendMessage('user-1', { content: 'xyz abc', conversationId: 'conv-1' });
      expect(res.cards?.some((c) => c.type === 'HANDOVER')).toBe(true);
    });

    it('báo hết lượt trong ngày, kèm nút gặp nhân viên', async () => {
      prisma.botMessage.count.mockResolvedValueOnce(20);
      const res = await service.sendMessage('user-1', { content: 'Alo bot ơi' });
      expect(res.isRateLimited).toBe(true);
      expect(res.cards?.[0].type).toBe('HANDOVER');
    });
  });

  describe('Gemini', () => {
    beforeEach(() => {
      env.GEMINI_API_KEY = 'test-key';
      env.GEMINI_MODEL = 'test-model';
    });

    it('trả lời bằng Gemini và lưu thẻ vào meta', async () => {
      fetchMock
        .mockResolvedValueOnce(geminiCall('get_order_status', {}))
        .mockResolvedValueOnce(geminiText('Đơn của bạn đang được quán làm món.'));
      const res = await service.sendMessage('user-1', { content: 'đơn mình tới đâu rồi' });
      expect(res.source).toBe('GEMINI');
      expect(res.cards?.[0]).toMatchObject({ type: 'ORDER_STATUS', orderId: OWN_ORDER.id });
      const saved = prisma.botMessage.create.mock.calls.at(-1)[0].data;
      expect(saved.meta.cards[0].type).toBe('ORDER_STATUS');
      // Gửi lại nguyên phần model (giữ thoughtSignature) ở vòng 2
      const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondBody.contents.some((c: any) => c.parts?.[0]?.thoughtSignature === 'sig')).toBe(true);
    });

    it('không trả đơn của người khác khi AI hỏi mã đơn lạ', async () => {
      fetchMock
        .mockResolvedValueOnce(geminiCall('get_order_status', { order_code: 'FFFFFFFF' }))
        .mockResolvedValueOnce(geminiText('Mình không tìm thấy đơn này.'));
      const res = await service.sendMessage('user-1', { content: 'đơn #FFFFFFFF' });
      const toolReply = JSON.parse(fetchMock.mock.calls[1][1].body).contents.at(-1).parts[0].functionResponse;
      expect(toolReply.response.found).toBe(false);
      expect(res.cards).toBeUndefined();
      // Chỉ truy vấn đơn của chính khách
      for (const call of prisma.order.findMany.mock.calls) {
        expect(call[0].where).toEqual({ customerId: 'user-1' });
      }
    });

    it('AI trả lời thẳng không gọi công cụ -> vẫn gắn thẻ đơn theo ý định', async () => {
      fetchMock.mockResolvedValueOnce(geminiText('Đơn của bạn đang được quán làm món nhé.'));
      const res = await service.sendMessage('user-1', { content: 'Đơn của tôi đang ở đâu?' });
      expect(res.source).toBe('GEMINI');
      expect(res.cards?.[0].type).toBe('ORDER_STATUS');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    });

    it('không gửi số điện thoại khách cho Gemini', async () => {
      fetchMock.mockResolvedValueOnce(geminiText('Ok bạn'));
      await service.sendMessage('user-1', { content: 'gọi mình số 0912345678' });
      expect(fetchMock.mock.calls[0][1].body).not.toContain('0912345678');
    });

    it('Gemini lỗi 429 -> chuyển sang bot kịch bản, không báo lỗi', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota' });
      const res = await service.sendMessage('user-1', { content: 'Đơn của tôi ở đâu?' });
      expect(res.source).toBe('SCRIPT');
      expect(res.cards?.[0].type).toBe('ORDER_STATUS');
    });

    it('lời chào báo đúng chế độ AI', async () => {
      const w = await service.getWelcome('user-1');
      expect(w.mode).toBe('AI');
      expect(w.greeting).toContain('Khoa');
      expect(w.remainingToday).toBe(20);
    });
  });

  describe('handover', () => {
    it('tạo phiếu kèm trích hội thoại đã che SĐT', async () => {
      prisma.botConversation.findUnique.mockResolvedValue({ id: 'conv-1', userId: 'user-1' });
      prisma.botMessage.findMany.mockResolvedValueOnce([{ role: 'user', content: 'Thiếu món rồi' }]);
      await service.handover('user-1', { conversationId: 'conv-1', summary: 'Gọi 0912345678 giúp mình' });
      const dto = tickets.createTicket.mock.calls[0][1];
      expect(dto.category).toBe('BOT_HANDOVER');
      expect(dto.description).toContain('Khách: Thiếu món rồi');
      expect(dto.description).not.toContain('0912345678');
    });

    it('không cho chuyển hội thoại của người khác', async () => {
      prisma.botConversation.findUnique.mockResolvedValue({ id: 'conv-x', userId: 'other' });
      await expect(service.handover('user-1', { conversationId: 'conv-x' })).rejects.toThrow();
      expect(tickets.createTicket).not.toHaveBeenCalled();
    });
  });
});
