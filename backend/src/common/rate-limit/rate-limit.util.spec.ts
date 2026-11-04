import { evaluateWindow, formatRetryAfter, RateLimitHit, recordHit } from './rate-limit.util';

const policy = { limit: 3, windowMs: 60_000 };

describe('rate-limit.util', () => {
  describe('recordHit / evaluateWindow', () => {
    it('cho phép tới đúng `limit` lần rồi báo chặn kèm thời gian chờ', () => {
      let hits: RateLimitHit[] = [];
      let state = recordHit(hits, 0, policy);
      expect(state).toMatchObject({ blocked: false, remaining: 2 });
      hits = state.hits;
      state = recordHit(hits, 10_000, policy);
      hits = state.hits;
      state = recordHit(hits, 20_000, policy);
      expect(state).toMatchObject({ blocked: true, remaining: 0 });
      // Hết chặn khi lần đầu (t=0) trôi khỏi cửa sổ 60 giây
      expect(state.retryAfterMs).toBe(40_000);
    });

    it('lần cũ trôi khỏi cửa sổ thì được thử lại', () => {
      const hits: RateLimitHit[] = [{ at: 0 }, { at: 10_000 }, { at: 20_000 }];
      expect(evaluateWindow(hits, 59_999, policy).blocked).toBe(true);
      const after = evaluateWindow(hits, 60_000, policy);
      expect(after).toMatchObject({ blocked: false, remaining: 1 });
      expect(after.hits).toHaveLength(2);
    });

    it('cùng `value` không tính thêm lượt (gửi lại cùng mã / cùng idempotency-key)', () => {
      let hits: RateLimitHit[] = [];
      for (let i = 0; i < 5; i++) hits = recordHit(hits, i * 1000, policy, 'SALE50').hits;
      const state = evaluateWindow(hits, 5000, policy);
      expect(state).toMatchObject({ blocked: false, remaining: 2 });
      expect(state.hits).toEqual([{ at: 4000, value: 'SALE50' }]);
    });

    it('các `value` khác nhau thì đếm riêng từng giá trị', () => {
      let hits: RateLimitHit[] = [];
      for (const code of ['A', 'B', 'C']) hits = recordHit(hits, 0, policy, code).hits;
      expect(evaluateWindow(hits, 1, policy).blocked).toBe(true);
    });

    it('chỉ giữ tối đa `limit` lần gần nhất để không phình bộ nhớ', () => {
      let hits: RateLimitHit[] = [];
      for (let i = 0; i < 50; i++) hits = recordHit(hits, i, policy).hits;
      expect(hits).toHaveLength(3);
    });
  });

  describe('formatRetryAfter', () => {
    it.each([
      [0, '1 giây'],
      [44_100, '45 giây'],
      [60_000, '1 phút'],
      [61_000, '2 phút'],
      [14 * 60_000 + 5_000, '15 phút'],
      [60 * 60_000, '1 giờ'],
      [65 * 60_000, '1 giờ 5 phút'],
    ])('%i ms → %s', (ms, text) => {
      expect(formatRetryAfter(ms)).toBe(text);
    });
  });
});
