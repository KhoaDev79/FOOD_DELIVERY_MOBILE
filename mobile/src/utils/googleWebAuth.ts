/**
 * Đăng nhập Google trên bản WEB bằng cách chuyển hẳn trang sang Google rồi quay lại (redirect),
 * thay cho cửa sổ popup: iPhone mở app từ "Màn hình chính" thì popup chạy ở trình duyệt riêng và
 * không gửi được kết quả về app. Google trả idToken trên phần "#" của địa chỉ khi quay lại.
 */

const STORAGE_KEY = 'zomzom.googleAuthState';
/** Phiên đăng nhập Google quá 10 phút thì bỏ (người dùng bỏ dở giữa chừng) */
const STATE_TTL_MS = 10 * 60_000;

function randomString(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Mở trang chọn tài khoản Google (rời khỏi app, Google sẽ chuyển về lại đúng địa chỉ gốc). */
export function startGoogleRedirect(clientId: string) {
  const state = randomString();
  storage()?.setItem(STORAGE_KEY, JSON.stringify({ state, at: Date.now() }));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: randomString(),
    state,
    prompt: 'select_account',
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export type GoogleRedirectResult = { idToken: string } | { error: string };

/** Đọc lời nhắn Google gửi về trên phần "#" của địa chỉ (null = không phải vừa quay về từ Google). */
export function parseGoogleRedirect(
  hash: string,
  stored: { state: string; at: number } | null,
  now = Date.now(),
): GoogleRedirectResult | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const idToken = params.get('id_token');
  const error = params.get('error');
  if (!idToken && !error) return null;

  // Chống giả mạo: chỉ nhận kết quả của lần bấm "Tiếp tục với Google" trên chính máy này
  const state = params.get('state');
  if (!stored || stored.state !== state || now - stored.at > STATE_TTL_MS) {
    return { error: 'Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.' };
  }
  if (error) {
    return {
      error:
        error === 'access_denied'
          ? 'Bạn đã huỷ đăng nhập bằng Google.'
          : 'Google chưa cho phép đăng nhập từ trang này. Vui lòng thử lại sau.',
    };
  }
  return { idToken: idToken! };
}

/** Lấy kết quả (nếu có) rồi xoá phần "#" khỏi thanh địa chỉ để tải lại trang không xử lý lại. */
export function takeGoogleRedirectResult(): GoogleRedirectResult | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  let stored: { state: string; at: number } | null = null;
  try {
    stored = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    stored = null;
  }
  const result = parseGoogleRedirect(window.location.hash, stored);
  if (!result) return null;
  storage()?.removeItem(STORAGE_KEY);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return result;
}
