import { ConflictException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { GoogleAuthService } from './google-auth.service';
import { decideGoogleAccount, profileFromGooglePayload } from './google-auth.util';

describe('google-auth.util', () => {
  const payload = { sub: 'g-1', email: 'Khoa@Gmail.com', email_verified: true, name: '  Trần  Khoa ', picture: 'https://p/a.jpg' };

  it('chuẩn hoá email, gộp dấu cách trong tên', () => {
    expect(profileFromGooglePayload(payload)).toEqual({
      sub: 'g-1',
      email: 'khoa@gmail.com',
      name: 'Trần Khoa',
      picture: 'https://p/a.jpg',
    });
  });

  it('không có tên thì lấy phần trước @ của email', () => {
    expect(profileFromGooglePayload({ ...payload, name: '' }).name).toBe('khoa');
  });

  it('từ chối email chưa được Google xác minh hoặc thiếu email', () => {
    expect(() => profileFromGooglePayload({ ...payload, email_verified: false })).toThrow('chưa được xác minh');
    expect(() => profileFromGooglePayload({ ...payload, email: undefined })).toThrow('không có email');
    expect(() => profileFromGooglePayload(undefined)).toThrow();
  });

  it('decideGoogleAccount', () => {
    expect(decideGoogleAccount(null, 'g-1')).toEqual({ action: 'CREATE' });
    expect(decideGoogleAccount({ googleId: 'g-1', isActive: true }, 'g-1')).toEqual({ action: 'LOGIN' });
    expect(decideGoogleAccount({ googleId: null, isActive: true }, 'g-1')).toEqual({ action: 'LINK' });
    expect(decideGoogleAccount({ googleId: 'g-2', isActive: true }, 'g-1')).toEqual({ action: 'REJECT', reason: 'OTHER_GOOGLE' });
    expect(decideGoogleAccount({ googleId: 'g-1', isActive: false }, 'g-1')).toEqual({ action: 'REJECT', reason: 'LOCKED' });
  });
});

describe('GoogleAuthService', () => {
  type Row = { id: string; email: string; googleId: string | null; isActive: boolean; avatarUrl: string | null };
  let users: Row[];
  let prisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let auth: { completeLogin: jest.Mock };
  let service: GoogleAuthService;
  const goodPayload = { sub: 'g-1', email: 'khoa@gmail.com', email_verified: true, name: 'Khoa', picture: 'https://p/a.jpg' };

  const build = (clientIds: string[] = ['web-id']) => {
    const config = { get: (key: string) => (key === 'googleClientIds' ? clientIds : true) };
    service = new GoogleAuthService(prisma, auth as never, new RateLimitService(config as never), config as never);
    service.setVerifier(async (token, audience) => {
      expect(audience).toEqual(clientIds);
      if (token === 'bad-token') throw new Error('Wrong recipient');
      return goodPayload;
    });
  };

  beforeEach(() => {
    users = [];
    prisma = {
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            users.find((u) => (where.googleId ? u.googleId === where.googleId : where.email ? u.email === where.email : u.id === where.id)) ??
              null,
          ),
        ),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(({ where, data }) => {
          const u = users.find((x) => x.id === where.id)!;
          Object.assign(u, data);
          return Promise.resolve(u);
        }),
        create: jest.fn(({ data }) => {
          const u = { id: `u${users.length + 1}`, isActive: true, ...data };
          users.push(u);
          return Promise.resolve(u);
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    auth = { completeLogin: jest.fn((user) => Promise.resolve({ user, accessToken: 'a', refreshToken: 'r' })) };
    build();
  });

  it('chưa cấu hình GOOGLE_CLIENT_IDS thì báo 503', async () => {
    build([]);
    await expect(service.login('tok', 'ip')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('idToken không hợp lệ (sai chữ ký / sai client ID) → 401', async () => {
    await expect(service.login('bad-token', 'ip')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('chưa có tài khoản: tạo khách hàng mới, chưa có SĐT, lấy ảnh Google, isNewUser = true', async () => {
    const res = await service.login('tok', 'ip');
    expect(res.isNewUser).toBe(true);
    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ email: 'khoa@gmail.com', googleId: 'g-1', role: 'CUSTOMER', avatarUrl: 'https://p/a.jpg', fullName: 'Khoa' });
    expect(created.phone).toBeUndefined();
    expect(created.passwordHash).toMatch(/^\$argon2/);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_REGISTER_GOOGLE' }) }));
  });

  it('đăng nhập lần 2 dùng lại tài khoản cũ, không tạo thêm', async () => {
    await service.login('tok', 'ip');
    const res = await service.login('tok', 'ip');
    expect(res.isNewUser).toBe(false);
    expect(users).toHaveLength(1);
  });

  it('đã có tài khoản mật khẩu cùng email: liên kết Google, giữ ảnh đại diện cũ', async () => {
    users.push({ id: 'old', email: 'khoa@gmail.com', googleId: null, isActive: true, avatarUrl: 'https://cdn/old.jpg' });
    const res = await service.login('tok', 'ip');
    expect(res.isNewUser).toBe(false);
    expect(users[0]).toMatchObject({ googleId: 'g-1', avatarUrl: 'https://cdn/old.jpg' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('tài khoản bị khoá → 403; email đã gắn Google khác → 409', async () => {
    users.push({ id: 'old', email: 'khoa@gmail.com', googleId: null, isActive: false, avatarUrl: null });
    await expect(service.login('tok', 'ip')).rejects.toBeInstanceOf(ForbiddenException);
    users[0] = { ...users[0], isActive: true, googleId: 'g-other' };
    await expect(service.login('tok', 'ip')).rejects.toBeInstanceOf(ConflictException);
  });
});
