import { rankSuggestions, SuggestionCandidate } from './restaurant-suggestions';

const item = (id: string, categoryId: string | null = 'main', extra: Partial<SuggestionCandidate> = {}) => ({
  id,
  categoryId,
  isAvailable: true,
  isArchived: false,
  ...extra,
});

describe('rankSuggestions', () => {
  const menu = [
    item('bun'),
    item('pho'),
    item('tra-da', 'drink'),
    item('cha-gio', 'side'),
    item('flan', 'dessert'),
    item('het-mon', 'drink', { isAvailable: false }),
    item('da-xoa', 'drink', { isArchived: true }),
  ];

  it('ưu tiên món hay được mua chung, rồi tới món bán chạy, rồi món khác', () => {
    const res = rankSuggestions({
      menu,
      boughtTogether: new Map([
        ['cha-gio', 3],
        ['tra-da', 7],
      ]),
      bestSellers: new Map([
        ['pho', 20],
        ['tra-da', 15],
      ]),
      cartItemIds: ['bun'],
    });
    expect(res.map((r) => [r.item.id, r.reason])).toEqual([
      ['tra-da', 'BOUGHT_TOGETHER'],
      ['cha-gio', 'BOUGHT_TOGETHER'],
      ['pho', 'BEST_SELLER'],
      ['flan', 'MENU'],
    ]);
  });

  it('bỏ món đã có trong giỏ, món hết hàng và món đã xoá', () => {
    const res = rankSuggestions({
      menu,
      boughtTogether: new Map([
        ['het-mon', 9],
        ['da-xoa', 9],
        ['bun', 9],
      ]),
      bestSellers: new Map(),
      cartItemIds: ['bun'],
    });
    const ids = res.map((r) => r.item.id);
    expect(ids).not.toContain('het-mon');
    expect(ids).not.toContain('da-xoa');
    expect(ids).not.toContain('bun');
  });

  it('quán chưa có dữ liệu: gợi ý món khác nhóm với giỏ trước', () => {
    const res = rankSuggestions({ menu, boughtTogether: new Map(), bestSellers: new Map(), cartItemIds: ['bun'] });
    expect(res.every((r) => r.reason === 'MENU')).toBe(true);
    expect(res[res.length - 1].item.id).toBe('pho'); // cùng nhóm "main" với Bún -> xếp cuối
  });

  it('giới hạn số món gợi ý', () => {
    const many = Array.from({ length: 20 }, (_, i) => item(`m${i}`));
    expect(rankSuggestions({ menu: many, boughtTogether: new Map(), bestSellers: new Map(), cartItemIds: [], limit: 5 })).toHaveLength(5);
  });
});
