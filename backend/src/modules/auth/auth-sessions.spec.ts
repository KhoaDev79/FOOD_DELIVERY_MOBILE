import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSecret } from '../../common/utils/password.util';
import { AuthService, MAX_SESSIONS_PER_USER } from './auth.service';

/**
 * Đăng nhập nhiều thiết bị: mỗi thiết bị một phiên; làm mới / đăng xuất chỉ ảnh hưởng phiên đó.
 * Dùng JwtService thật và một "DB" nhỏ trong bộ nhớ để kiểm tra đúng luồng xoay vòng token.
 */
describe('AuthService – phiên theo thiết bị', () => {
  let service: AuthService;
  let user: any;
  let sessions: Map<string, any>;
  let prisma: any;
  const jwt = new JwtService();

  beforeEach(async () => {
    user = {
      id: 'u1',
      email: 'khach@test.com',
      username: 'khach',
      role: 'CUSTOMER',
      isActive: true,
      passwordHash: await hashSecret('Password123!'),
      refreshTokenHash: null,
    };
    sessions = new Map();
    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.id === user.id || where.username === user.username || where.email === user.email ? { ...user } : null,
        ),
        update: jest.fn(async ({ data }: any) => Object.assign(user, data)),
      },
      driverProfile: { updateMany: jest.fn() },
      restaurant: { updateMany: jest.fn() },
      authSession: {
        create: jest.fn(async ({ data }: any) => {
          sessions.set(data.id, { revokedAt: null, lastUsedAt: new Date(), ...data });
        }),
        update: jest.fn(async ({ where, data }: any) => Object.assign(sessions.get(where.id), data)),
        findUnique: jest.fn(async ({ where }: any) => (sessions.has(where.id) ? { ...sessions.get(where.id) } : null)),
        findMany: jest.fn(async ({ where }: any) =>
          [...sessions.values()]
            .filter((s) => s.userId === where.userId && !s.revokedAt)
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt),
        ),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const ids: string[] = where.id?.in ?? [where.id];
          let count = 0;
          for (const id of ids) {
            const s = sessions.get(id);
            if (s && !s.revokedAt) {
              Object.assign(s, data);
              count++;
            }
          }
          return { count };
        }),
        deleteMany: jest.fn(),
      },
    };
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'jwt.refreshSecret'
          ? 'refresh-secret'
          : { accessSecret: 'access-secret', refreshSecret: 'refresh-secret', accessExpiresIn: '15m', refreshExpiresIn: '30d' },
      ),
    };
    service = new AuthService(prisma, jwt, config as any, new RateLimitService({ get: () => true } as any));
  });

  const login = (device: string) => service.login({ username: 'khach', password: 'Password123!' } as any, device);

  it('đăng nhập thiết bị thứ 2 không làm thiết bị 1 bị đăng xuất', async () => {
    const phone = await login('iPhone');
    const web = await login('Chrome');
    expect(sessions.size).toBe(2);

    const phone2 = await service.refresh(phone.refreshToken);
    const web2 = await service.refresh(web.refreshToken);
    expect(phone2.refreshToken).not.toBe(phone.refreshToken);
    expect(web2.accessToken).toBeTruthy();
  });

  it('dùng lại refresh token cũ của một phiên: thu hồi phiên đó, phiên khác vẫn chạy', async () => {
    const phone = await login('iPhone');
    const web = await login('Chrome');
    await service.refresh(phone.refreshToken);

    await expect(service.refresh(phone.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(web.refreshToken)).resolves.toBeTruthy();
  });

  it('đăng xuất chỉ thu hồi thiết bị hiện tại', async () => {
    const phone = await login('iPhone');
    const web = await login('Chrome');
    await service.logout(phone.refreshToken);

    await expect(service.refresh(phone.refreshToken)).rejects.toThrow('Phiên đăng nhập đã kết thúc');
    await expect(service.refresh(web.refreshToken)).resolves.toBeTruthy();
  });

  it('khoá tài khoản / đổi mật khẩu (đặt refreshTokenHash = null) thu hồi mọi thiết bị', async () => {
    const phone = await login('iPhone');
    const web = await login('Chrome');
    user.refreshTokenHash = null;

    await expect(service.refresh(phone.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(web.refreshToken)).rejects.toThrow(UnauthorizedException);

    // Đăng nhập lại thì tạo thế hệ phiên mới, dùng bình thường
    const again = await login('iPhone');
    await expect(service.refresh(again.refreshToken)).resolves.toBeTruthy();
  });

  it('token kiểu cũ (trước khi có phiên) vẫn làm mới được, chuyển sang phiên mới', async () => {
    const legacy = await jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: 'refresh-secret', expiresIn: '30d' },
    );
    user.refreshTokenHash = await hashSecret(legacy);

    const tokens = await service.refresh(legacy);
    expect(sessions.size).toBe(1);
    await expect(service.refresh(tokens.refreshToken)).resolves.toBeTruthy();
  });

  it(`giữ tối đa ${MAX_SESSIONS_PER_USER} thiết bị: thiết bị dùng lâu nhất bị đăng xuất`, async () => {
    const first = await login('may-1');
    for (let i = 2; i <= MAX_SESSIONS_PER_USER + 1; i++) {
      // Đảm bảo thứ tự lastUsedAt
      await new Promise((r) => setTimeout(r, 2));
      await login(`may-${i}`);
    }
    const active = [...sessions.values()].filter((s) => !s.revokedAt);
    expect(active).toHaveLength(MAX_SESSIONS_PER_USER);
    await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
