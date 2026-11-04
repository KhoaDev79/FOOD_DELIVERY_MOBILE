import { rankHelpArticles, RankableHelpArticle } from './help-ranking.util';

describe('help-ranking.util', () => {
  const sampleArticles: RankableHelpArticle[] = [
    {
      id: 'art-1',
      categoryId: 'cat-1',
      title: 'Cách tính phí ship và phụ phí cao điểm',
      body: 'Phí ship cơ bản là 15.000đ cho 2km đầu tiên. Mỗi km tiếp theo cộng 5.000đ.',
      keywords: ['phí ship', 'giao hàng', 'cước phí'],
      sortOrder: 1,
      helpfulCount: 20,
      notHelpfulCount: 1,
      viewCount: 100,
    },
    {
      id: 'art-2',
      categoryId: 'cat-1',
      title: 'Thời gian giao hàng dự kiến',
      body: 'Thời gian giao hàng phụ thuộc vào khoảng cách và thời gian chuẩn bị món của quán.',
      keywords: ['thời gian', 'khi nào nhận được', 'giao trễ'],
      sortOrder: 2,
      helpfulCount: 15,
      notHelpfulCount: 0,
      viewCount: 80,
    },
    {
      id: 'art-3',
      categoryId: 'cat-2',
      title: 'Chính sách huỷ đơn hàng',
      body: 'Bạn chỉ có thể huỷ đơn khi quán chưa xác nhận (trạng thái PENDING). Sau đó cần liên hệ hỗ trợ.',
      keywords: ['huỷ đơn', 'đổi ý', 'không muốn mua'],
      sortOrder: 3,
      helpfulCount: 30,
      notHelpfulCount: 2,
      viewCount: 150,
    },
    {
      id: 'art-4',
      categoryId: 'cat-3',
      title: 'Thanh toán tiền mặt COD',
      body: 'Bạn thanh toán đúng số tiền cho tài xế khi nhận hàng.',
      keywords: ['tiền mặt', 'cod', 'thanh toán'],
      sortOrder: 4,
      helpfulCount: 5,
      notHelpfulCount: 0,
      viewCount: 50,
    },
    {
      id: 'art-5',
      categoryId: 'cat-2',
      title: 'Xử lý khi thiếu món hoặc sai món',
      body: 'Nếu đơn hàng bị thiếu món, vui lòng báo vấn đề trong vòng 24 giờ kèm ảnh chụp món nhận được.',
      keywords: ['thiếu món', 'sai món', 'món bị hỏng'],
      sortOrder: 5,
      helpfulCount: 40,
      notHelpfulCount: 1,
      viewCount: 200,
    },
  ];

  it('trả về danh sách sắp xếp theo sortOrder / viewCount khi không truyền từ khoá', () => {
    const results = rankHelpArticles(sampleArticles, '');
    expect(results.length).toBe(5);
    expect(results[0].id).toBe('art-1');
  });

  it('tìm kiếm không dấu và viết hoa thường (VD: "phi ship" tìm ra bài về phí ship)', () => {
    const results = rankHelpArticles(sampleArticles, 'phi ship');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('art-1');
  });

  it('ưu tiên bài trùng khớp tiêu đề hơn bài chỉ trùng trong nội dung', () => {
    const customArticles: RankableHelpArticle[] = [
      {
        id: 'art-body-only',
        categoryId: 'cat-1',
        title: 'Giới thiệu ứng dụng ZomZom',
        body: 'Hệ thống có chính sách huỷ đơn rất rõ ràng.',
        keywords: ['zomzom', 'thông tin'],
        sortOrder: 1,
        helpfulCount: 1,
        notHelpfulCount: 0,
        viewCount: 10,
      },
      {
        id: 'art-title-match',
        categoryId: 'cat-1',
        title: 'Quy trình huỷ đơn',
        body: 'Chi tiết các bước để huỷ đơn hàng.',
        keywords: ['huỷ', 'đơn hàng'],
        sortOrder: 2,
        helpfulCount: 1,
        notHelpfulCount: 0,
        viewCount: 10,
      },
    ];

    const results = rankHelpArticles(customArticles, 'huy don');
    expect(results[0].id).toBe('art-title-match');
  });

  it('ưu tiên bài khớp từ khoá (keywords) hơn bài chỉ khớp nội dung', () => {
    const customArticles: RankableHelpArticle[] = [
      {
        id: 'art-body-match',
        categoryId: 'cat-1',
        title: 'Hướng dẫn sử dụng',
        body: 'Tài xế giao trễ sẽ được ghi nhận.',
        keywords: ['hướng dẫn'],
        sortOrder: 1,
        helpfulCount: 1,
        notHelpfulCount: 0,
        viewCount: 10,
      },
      {
        id: 'art-kw-match',
        categoryId: 'cat-1',
        title: 'Thời gian phục vụ',
        body: 'Quán mở cửa từ sáng tới tối.',
        keywords: ['giao trễ', 'thời gian'],
        sortOrder: 2,
        helpfulCount: 1,
        notHelpfulCount: 0,
        viewCount: 10,
      },
    ];

    const results = rankHelpArticles(customArticles, 'giao tre');
    expect(results[0].id).toBe('art-kw-match');
  });

  it('giới hạn tối đa số lượng bài trả về theo tham số limit', () => {
    const manyArticles: RankableHelpArticle[] = Array.from({ length: 15 }, (_, i) => ({
      id: `art-many-${i}`,
      categoryId: 'cat-1',
      title: `Chính sách ${i} cho đơn hàng`,
      body: 'Nội dung chi tiết...',
      keywords: ['chính sách', 'đơn hàng'],
      sortOrder: i,
      helpfulCount: 0,
      notHelpfulCount: 0,
      viewCount: 10,
    }));

    const results = rankHelpArticles(manyArticles, 'chinh sach', 10);
    expect(results.length).toBe(10);
  });

  it('trả về mảng rỗng nếu không có bài nào liên quan đến từ khoá', () => {
    const results = rankHelpArticles(sampleArticles, 'tu_khoa_hoan_toan_khong_ton_tai_xyz');
    expect(results).toEqual([]);
  });
});

