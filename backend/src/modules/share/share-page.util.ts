/**
 * Trang chia sẻ quán/món (link https ngắn /s/r/:id, /s/d/:id).
 * Zalo, Messenger, Facebook chỉ bấm được link https và đọc thẻ Open Graph để hiện ảnh xem trước,
 * nên chia sẻ link này thay cho fooddelivery:// (link scheme không bấm được trong các app chat).
 */

export const APP_SCHEME = 'fooddelivery';

/** Chống chèn mã vào HTML: tên quán/món do chủ quán nhập. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Gốc URL công khai của request, tôn trọng header của proxy (Caddy, Render) để ra đúng https. */
export function requestOrigin(headers: Record<string, string | string[] | undefined>, fallbackProto: string): string {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
  const proto = first(headers['x-forwarded-proto']) || fallbackProto || 'http';
  const host = first(headers['x-forwarded-host']) || first(headers.host) || 'localhost';
  return `${proto}://${host}`;
}

/**
 * Ảnh cho thẻ xem trước phải là URL tuyệt đối http(s). Ảnh nội bộ "/public/..." ghép với gốc máy chủ;
 * ảnh base64 (data URI) cũ thì bỏ vì mạng xã hội không đọc được.
 */
export function absoluteImageUrl(img: string | null | undefined, origin: string): string | null {
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith('/')) return `${origin}${img}`;
  return null;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export interface SharePageInput {
  /** Tiêu đề thẻ, vd "Bún Bò Huế Cố Đô" hoặc "Bún bò đặc biệt – Bún Bò Huế Cố Đô" */
  title: string;
  /** Dòng mô tả ngắn: sao, địa chỉ, giá… */
  description: string;
  imageUrl: string | null;
  /** Link mở app, vd fooddelivery://restaurant/<id> */
  appUrl: string;
  /** Link bản web nếu đã deploy (WEB_APP_URL), null nếu chưa có */
  webUrl: string | null;
  /** URL của chính trang này (og:url) */
  pageUrl: string;
  badge?: string | null;
}

export function renderSharePage(p: SharePageInput): string {
  const t = escapeHtml(p.title);
  const d = escapeHtml(p.description);
  const img = p.imageUrl ? escapeHtml(p.imageUrl) : null;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} | ZomZom</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ZomZom">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(p.pageUrl)}">
${img ? `<meta property="og:image" content="${img}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F1F5F9;color:#0F172A}
  header{background:linear-gradient(160deg,#0E4A55,#0B7F90);color:#fff;padding:20px 20px 64px}
  .brand{font-weight:800;font-size:20px;letter-spacing:.2px}.brand span{color:#FF7A1A}
  main{max-width:440px;margin:-48px auto 24px;padding:0 16px}
  .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08)}
  .cover{width:100%;height:200px;object-fit:cover;display:block;background:#E9FAFC}
  .body{padding:16px 18px 20px}h1{font-size:22px;margin:0 0 6px}
  .desc{color:#475569;font-size:15px;line-height:1.45;margin:0}
  .badge{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;background:#FEF3C7;color:#92400E;font-size:13px;font-weight:600}
  .btn{display:block;text-align:center;text-decoration:none;font-weight:700;font-size:16px;padding:15px;border-radius:999px;margin-top:12px}
  .primary{background:#0B7F90;color:#fff}.secondary{background:#E9FAFC;color:#0B7C8C}
  .note{text-align:center;color:#64748B;font-size:13px;margin-top:14px}
</style>
</head>
<body>
<header><div class="brand">Zom<span>Zom</span></div></header>
<main>
  <div class="card">
    ${img ? `<img class="cover" src="${img}" alt="${t}">` : '<div class="cover"></div>'}
    <div class="body">
      <h1>${t}</h1>
      <p class="desc">${d}</p>
      ${p.badge ? `<span class="badge">${escapeHtml(p.badge)}</span>` : ''}
      <a class="btn primary" href="${escapeHtml(p.appUrl)}">Mở trong ứng dụng ZomZom</a>
      ${p.webUrl ? `<a class="btn secondary" href="${escapeHtml(p.webUrl)}">Đặt món trên trình duyệt</a>` : ''}
    </div>
  </div>
  <p class="note">Chưa có ứng dụng? Cài ZomZom để đặt món giao tận nơi.</p>
</main>
</body>
</html>`;
}

/** Trang báo link hỏng / quán ngừng hoạt động (vẫn là HTML để hiển thị đẹp trong trình duyệt). */
export function renderNotFoundPage(message: string): string {
  return renderSharePage({
    title: 'Không tìm thấy',
    description: message,
    imageUrl: null,
    appUrl: `${APP_SCHEME}://`,
    webUrl: null,
    pageUrl: '',
  });
}
