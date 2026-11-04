/**
 * Mẫu email (hàm thuần). Viết HTML dạng bảng + style inline vì Gmail/Outlook bỏ thẻ <style> và flexbox.
 * Màu theo thương hiệu ZomZom (cam #FF7A1A).
 */

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND = '#FF7A1A';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Khung chung: logo chữ, thẻ nội dung bo góc, chân trang. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:32px 16px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="padding:0 4px 20px;font-size:24px;font-weight:800;letter-spacing:.2px;color:#111827">Zom<span style="color:${BRAND}">Zom</span></td></tr>
    <tr><td style="background:#FFFFFF;border-radius:20px;padding:32px 28px;box-shadow:0 4px 18px rgba(17,24,39,.06)">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:#9CA3AF;text-align:center">
      Email tự động từ ZomZom, vui lòng không trả lời email này.<br>Nhân viên ZomZom không bao giờ hỏi mã xác nhận của bạn.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/** Email chứa mã OTP 6 số để đặt lại mật khẩu. */
export function passwordResetOtpEmail(params: { fullName: string; code: string; expiresInMinutes: number }): MailContent {
  const name = escapeHtml(params.fullName || 'bạn');
  const digits = params.code
    .split('')
    .map(
      (d) =>
        `<td style="width:44px;height:54px;background:#FFF4EC;border:1px solid #FFD9BF;border-radius:12px;font-size:26px;font-weight:800;color:#111827;text-align:center;font-family:'SFMono-Regular',Consolas,monospace">${d}</td>`,
    )
    .join('<td style="width:8px"></td>');

  const html = layout(
    'Mã đặt lại mật khẩu',
    `<div style="width:52px;height:52px;border-radius:16px;background:#FFF4EC;text-align:center;line-height:52px;font-size:26px">🔐</div>
      <h1 style="margin:18px 0 8px;font-size:22px;line-height:28px;color:#111827">Đặt lại mật khẩu</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:22px;color:#4B5563">Xin chào ${name}, đây là mã xác nhận để đặt lại mật khẩu tài khoản ZomZom của bạn:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 22px"><tr>${digits}</tr></table>
      <p style="margin:0 0 6px;font-size:14px;line-height:21px;color:#4B5563;text-align:center">Mã có hiệu lực trong <b style="color:${BRAND}">${params.expiresInMinutes} phút</b>.</p>
      <div style="margin-top:24px;padding:14px 16px;background:#F9FAFB;border-radius:12px;font-size:13px;line-height:20px;color:#6B7280">
        Không phải bạn yêu cầu? Bạn có thể bỏ qua email này, mật khẩu của bạn vẫn giữ nguyên. Tuyệt đối không chia sẻ mã cho bất kỳ ai.
      </div>`,
  );
  const text =
    `Xin chào ${params.fullName || 'bạn'},\n\n` +
    `Mã đặt lại mật khẩu ZomZom của bạn là: ${params.code}\n` +
    `Mã có hiệu lực trong ${params.expiresInMinutes} phút. Không chia sẻ mã cho bất kỳ ai.\n\n` +
    'Không phải bạn yêu cầu? Hãy bỏ qua email này.';
  return { subject: `${params.code} là mã đặt lại mật khẩu ZomZom`, html, text };
}

/** Email báo mật khẩu vừa được đổi (để chủ tài khoản phát hiện nếu không phải mình làm). */
export function passwordChangedEmail(params: { fullName: string; changedAt: Date }): MailContent {
  const name = escapeHtml(params.fullName || 'bạn');
  const when = params.changedAt.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const html = layout(
    'Mật khẩu đã được thay đổi',
    `<div style="width:52px;height:52px;border-radius:16px;background:#ECFDF5;text-align:center;line-height:52px;font-size:26px">✅</div>
      <h1 style="margin:18px 0 8px;font-size:22px;line-height:28px;color:#111827">Mật khẩu đã được thay đổi</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#4B5563">Xin chào ${name}, mật khẩu tài khoản ZomZom của bạn vừa được đặt lại lúc <b>${when}</b>.</p>
      <p style="margin:0;font-size:15px;line-height:22px;color:#4B5563">Để bảo vệ tài khoản, chúng tôi đã đăng xuất bạn khỏi tất cả thiết bị.</p>
      <div style="margin-top:24px;padding:14px 16px;background:#FEF2F2;border-radius:12px;font-size:13px;line-height:20px;color:#B91C1C">
        Không phải bạn thực hiện? Hãy dùng "Quên mật khẩu" để lấy lại tài khoản ngay và liên hệ Trung tâm trợ giúp.
      </div>`,
  );
  const text =
    `Xin chào ${params.fullName || 'bạn'},\n\n` +
    `Mật khẩu tài khoản ZomZom của bạn vừa được đặt lại lúc ${when}. Bạn đã được đăng xuất khỏi tất cả thiết bị.\n\n` +
    'Không phải bạn thực hiện? Hãy dùng "Quên mật khẩu" để lấy lại tài khoản ngay.';
  return { subject: 'Mật khẩu ZomZom của bạn đã được thay đổi', html, text };
}
