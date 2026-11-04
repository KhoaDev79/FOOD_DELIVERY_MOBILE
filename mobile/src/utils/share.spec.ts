import { dishShareMessage, dishShareUrl, restaurantShareMessage, restaurantShareUrl } from './share';

describe('share utils', () => {
  it('link https ngắn, bỏ dấu / thừa ở gốc', () => {
    expect(restaurantShareUrl('https://api.zomzom.vn/', 'abc')).toBe('https://api.zomzom.vn/s/r/abc');
    expect(dishShareUrl('http://192.168.1.10:3000', 'd1')).toBe('http://192.168.1.10:3000/s/d/d1');
  });

  it('lời nhắn quán có sao khi đã có đánh giá', () => {
    const msg = restaurantShareMessage({ name: 'Phở Ngon', rating: 4.86, ratingCount: 12, address: '45 Lê Lợi' }, 'U');
    expect(msg).toContain('Phở Ngon ⭐ 4.9');
    expect(msg).toContain('📍 45 Lê Lợi');
    expect(msg.endsWith('U')).toBe(true);
    expect(restaurantShareMessage({ name: 'Mới mở', rating: 0, ratingCount: 0 }, 'U')).not.toContain('⭐');
  });

  it('lời nhắn món hiện giá khuyến mãi kèm giá gốc', () => {
    expect(dishShareMessage({ name: 'Bún bò', price: 50000, discountPrice: 40000 }, 'Quán A', 'U')).toContain('giá gốc');
    expect(dishShareMessage({ name: 'Bún bò', price: 50000, discountPrice: null }, 'Quán A', 'U')).not.toContain('giá gốc');
  });
});
