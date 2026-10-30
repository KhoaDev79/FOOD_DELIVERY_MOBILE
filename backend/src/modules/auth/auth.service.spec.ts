import { UnauthorizedException } from '@nestjs/common';
import { hashSecret } from '../../common/utils/password.util';
import { generateUniqueUsername, normalizeUsername } from '../../common/utils/username.util';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  let prisma: any;
  let service: AuthService;
  let user: any;

  beforeAll(async () => {
    user = {
      id: 'u1',
      email: 'admin@fooddelivery.com',
      username: 'admin',
      role: 'ADMIN',
      isActive: true,
      passwordHash: await hashSecret('Password123!'),
    };
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.username === user.username || where.email === user.email ? user : null),
        ),
        update: jest.fn(),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ accessSecret: 'a', refreshSecret: 'r', accessExpiresIn: '15m', refreshExpiresIn: '7d' }),
    };
    service = new AuthService(prisma, jwt as any, config as any);
  });

  it('đăng nhập bằng tên đăng nhập (không phân biệt hoa thường)', async () => {
    const res = await service.login({ username: 'Admin', password: 'Password123!' });
    expect(res.user.id).toBe('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
  });

  it('vẫn đăng nhập được bằng email', async () => {
    await service.login({ username: 'admin@fooddelivery.com', password: 'Password123!' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@fooddelivery.com' } });
    await expect(service.login({ email: 'admin@fooddelivery.com', password: 'Password123!' })).resolves.toBeTruthy();
  });

  it('sai mật khẩu hoặc tên đăng nhập → 401', async () => {
    await expect(service.login({ username: 'admin', password: 'sai-mat-khau' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.login({ username: 'khongton', password: 'Password123!' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('username.util', () => {
  it('chuẩn hoá và sinh tên không trùng', async () => {
    expect(normalizeUsername(' An.Nguyen+1 ')).toBe('an.nguyen1');
    const taken = new Set(['an', 'an2']);
    const db = { user: { findUnique: jest.fn(({ where }) => Promise.resolve(taken.has(where.username) ? {} : null)) } };
    await expect(generateUniqueUsername(db as any, 'An@gmail.com')).resolves.toBe('an3');
  });
});
