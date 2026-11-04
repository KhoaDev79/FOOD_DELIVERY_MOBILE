import { absoluteImageUrl, escapeHtml, renderSharePage, requestOrigin } from './share-page.util';

describe('share-page.util', () => {
  it('escapeHtml chặn chèn thẻ/thuộc tính từ tên quán', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(escapeHtml(`Quán "Ngon" & 'Rẻ'`)).toBe('Quán &quot;Ngon&quot; &amp; &#39;Rẻ&#39;');
  });

  it('requestOrigin ưu tiên header của proxy để ra đúng https', () => {
    expect(requestOrigin({ host: 'api:3000' }, 'http')).toBe('http://api:3000');
    expect(
      requestOrigin({ host: 'api:3000', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'zomzom.duckdns.org' }, 'http'),
    ).toBe('https://zomzom.duckdns.org');
    expect(requestOrigin({ host: 'a.com', 'x-forwarded-proto': 'https, http' }, 'http')).toBe('https://a.com');
  });

  it('absoluteImageUrl: giữ link http(s), ghép /public với gốc, bỏ base64', () => {
    expect(absoluteImageUrl('https://res.cloudinary.com/x.jpg', 'https://a.com')).toBe('https://res.cloudinary.com/x.jpg');
    expect(absoluteImageUrl('/public/images/a.jpg', 'https://a.com')).toBe('https://a.com/public/images/a.jpg');
    expect(absoluteImageUrl('data:image/png;base64,AAAA', 'https://a.com')).toBeNull();
    expect(absoluteImageUrl(null, 'https://a.com')).toBeNull();
  });

  it('renderSharePage có thẻ Open Graph, nút mở app; nút web chỉ khi có link', () => {
    const html = renderSharePage({
      title: 'Phở <b>Ngon</b>',
      description: '⭐ 4.7',
      imageUrl: 'https://img/x.jpg',
      appUrl: 'fooddelivery://restaurant/1',
      webUrl: null,
      pageUrl: 'https://a.com/s/r/1',
    });
    expect(html).toContain('<meta property="og:title" content="Phở &lt;b&gt;Ngon&lt;/b&gt;">');
    expect(html).toContain('<meta property="og:image" content="https://img/x.jpg">');
    expect(html).toContain('href="fooddelivery://restaurant/1"');
    expect(html).not.toContain('Đặt món trên trình duyệt');
    expect(html).not.toContain('<b>Ngon</b>');
  });
});
