import { parseGoogleRedirect } from './googleWebAuth';

describe('parseGoogleRedirect', () => {
  const stored = { state: 'abc', at: 1_000_000 };

  it('không có id_token/error thì không phải vừa quay về từ Google', () => {
    expect(parseGoogleRedirect('', stored, 1_000_100)).toBeNull();
    expect(parseGoogleRedirect('#tab=home', stored, 1_000_100)).toBeNull();
  });

  it('nhận idToken khi state khớp và còn hạn', () => {
    expect(parseGoogleRedirect('#state=abc&id_token=tok123&authuser=0', stored, 1_000_100)).toEqual({ idToken: 'tok123' });
  });

  it('state sai / không có / quá 10 phút thì từ chối', () => {
    expect(parseGoogleRedirect('#state=xyz&id_token=tok', stored, 1_000_100)).toHaveProperty('error');
    expect(parseGoogleRedirect('#state=abc&id_token=tok', null, 1_000_100)).toHaveProperty('error');
    expect(parseGoogleRedirect('#state=abc&id_token=tok', stored, 1_000_000 + 11 * 60_000)).toHaveProperty('error');
  });

  it('người dùng huỷ ở trang Google', () => {
    expect(parseGoogleRedirect('#state=abc&error=access_denied', stored, 1_000_100)).toEqual({
      error: 'Bạn đã huỷ đăng nhập bằng Google.',
    });
  });
});
