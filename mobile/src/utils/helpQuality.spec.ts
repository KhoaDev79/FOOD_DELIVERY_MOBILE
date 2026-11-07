import { articleQuality, formatLatency, inlineSegments, keywordsFromQuestion, percent } from './helpQuality';

describe('helpQuality', () => {
  it('chưa đủ 3 lượt đánh giá thì chưa kết luận', () => {
    expect(articleQuality({ helpfulCount: 0, notHelpfulCount: 2 })).toMatchObject({
      votes: 2,
      helpfulRate: 0,
      needsRewrite: false,
      level: 'unknown',
    });
    expect(articleQuality({ helpfulCount: 0, notHelpfulCount: 0 }).helpfulRate).toBeNull();
  });

  it('dưới 60% 👍 thì gợi ý viết lại; từ 80% là tốt', () => {
    expect(articleQuality({ helpfulCount: 1, notHelpfulCount: 2 })).toMatchObject({ needsRewrite: true, level: 'bad' });
    expect(articleQuality({ helpfulCount: 7, notHelpfulCount: 3 })).toMatchObject({ needsRewrite: false, level: 'ok' });
    expect(articleQuality({ helpfulCount: 8, notHelpfulCount: 2 }).level).toBe('good');
  });

  it('percent / formatLatency', () => {
    expect(percent(null)).toBe('—');
    expect(percent(0.333)).toBe('33%');
    expect(formatLatency(850)).toBe('850 ms');
    expect(formatLatency(2532)).toBe('2,5 giây');
  });

  it('keywordsFromQuestion bỏ từ đệm, giữ dấu tiếng Việt', () => {
    expect(keywordsFromQuestion('Cho tôi hỏi đổi số điện thoại thế nào?')).toEqual(['hỏi', 'đổi', 'số', 'điện', 'thoại']);
  });
});

describe('inlineSegments', () => {
  it('tách chữ đậm / nghiêng, giữ nguyên phần còn lại', () => {
    expect(inlineSegments('**Cước cơ bản:** 15.000 đ cho *2 km* đầu')).toEqual([
      { text: 'Cước cơ bản:', bold: true },
      { text: ' 15.000 đ cho ' },
      { text: '2 km', italic: true },
      { text: ' đầu' },
    ]);
  });
  it('dấu * lẻ (vd phép nhân) không bị coi là định dạng', () => {
    expect(inlineSegments('Giá x 2 * 3')).toEqual([{ text: 'Giá x 2 * 3' }]);
  });
});
