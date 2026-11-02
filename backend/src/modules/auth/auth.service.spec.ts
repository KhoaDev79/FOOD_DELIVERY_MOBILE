import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hashSecret } from '../../common/utils/password.util';
import { generateUniqueUsername, normalizeUsername } from '../../common/utils/username.util';
import { AuthStateService } from './auth-state.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/auth.dto';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('AuthService.login & register', () => {
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'new-u', isActive: true, createdAt: new Date(), ...data })),
        update: jest.fn(),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ accessSecret: 'a', refreshSecret: 'r', accessExpiresIn: '15m', refreshExpiresIn: '7d' }),
    };
    service = new AuthService(prisma, jwt as any, config as any);
  });

  it('đăng ký mới luôn gán role CUSTOMER', async () => {
    const res = await service.register({
      email: 'newuser@fooddelivery.com',
      password: 'Password123!',
      fullName: 'Khách Mới',
    });
    expect(res.user.role).toBe(Role.CUSTOMER);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.CUSTOMER }),
      }),
    );
  });

  it('ValidationPipe từ chối payload đăng ký có trường role (forbidNonWhitelisted)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        {
          email: 'newuser@fooddelivery.com',
          password: 'Password123!',
          fullName: 'Khách Mới',
          role: 'RESTAURANT_OWNER',
        },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('email đã đăng ký → 409 với thông báo rõ ràng', async () => {
    await expect(
      service.register({ email: 'admin@fooddelivery.com', password: 'Password123!', fullName: 'Trùng Email' }),
    ).rejects.toThrow('Email này đã được đăng ký');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  describe('RegisterDto qua ValidationPipe', () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const run = (body: Record<string, unknown>) => pipe.transform(body, { type: 'body', metatype: RegisterDto });
    const base = { email: 'a@b.vn', password: 'Password123!', fullName: 'Nguyễn Văn A' };
    const messagesOf = async (body: Record<string, unknown>) => {
      try {
        await run(body);
        return [];
      } catch (e) {
        return ((e as BadRequestException).getResponse() as { message: string[] }).message;
      }
    };

    it('chuẩn hoá số điện thoại về dạng 0xxxxxxxxx, chuỗi rỗng coi như không nhập', async () => {
      await expect(run({ ...base, phone: '+84 912 345 678' })).resolves.toMatchObject({ phone: '0912345678' });
      await expect(run({ ...base, phone: '0912.345.678' })).resolves.toMatchObject({ phone: '0912345678' });
      const empty = (await run({ ...base, phone: '' })) as RegisterDto;
      expect(empty.phone).toBeUndefined();
    });

    it('từ chối số 11 chữ số và đầu số không tồn tại', async () => {
      expect(await messagesOf({ ...base, phone: '09123456789' })).toEqual([
        expect.stringContaining('Số điện thoại di động không hợp lệ'),
      ]);
      expect(await messagesOf({ ...base, phone: '0112345678' })).toHaveLength(1);
    });

    it('họ tên được gộp dấu cách; toàn dấu cách hoặc không có chữ cái thì bị từ chối', async () => {
      await expect(run({ ...base, fullName: '  Trần   Văn  B ' })).resolves.toMatchObject({ fullName: 'Trần Văn B' });
      expect(await messagesOf({ ...base, fullName: '     ' })).not.toHaveLength(0);
      expect(await messagesOf({ ...base, fullName: '1234' })).toEqual([expect.stringContaining('chữ cái')]);
    });

    it('thông báo lỗi bằng tiếng Việt', async () => {
      const msgs = await messagesOf({ email: 'sai', password: '123', fullName: 'A' });
      expect(msgs).toEqual(
        expect.arrayContaining(['Email không đúng định dạng', 'Mật khẩu phải từ 8 ký tự trở lên', 'Họ tên tối thiểu 2 ký tự']),
      );
    });
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

describe('JwtStrategy & AuthStateService', () => {
  it('chặn ngay khi tài khoản bị khoá hoặc đổi vai trò sau khi invalidate cache', async () => {
    let dbState: { isActive: boolean; role: Role } = { isActive: true, role: Role.CUSTOMER };
    const prisma = {
      user: {
        findUnique: jest.fn(() => Promise.resolve(dbState)),
      },
    };
    const config = {
      get: jest.fn().mockReturnValue(30),
      getOrThrow: jest.fn().mockReturnValue('secret-1234567890'),
    };
    const authState = new AuthStateService(prisma as any, config as any);
    const strategy = new JwtStrategy(config as any, authState);

    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: Role.CUSTOMER }),
    ).resolves.toEqual({ id: 'u1', email: 'a@b.com', role: Role.CUSTOMER });

    // Khoá tài khoản + invalidate
    dbState = { isActive: false, role: Role.CUSTOMER };
    authState.invalidate('u1');
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: Role.CUSTOMER }),
    ).rejects.toThrow('Tài khoản đã bị khoá');

    // Mở lại nhưng đổi role + invalidate
    dbState = { isActive: true, role: Role.DRIVER };
    authState.invalidate('u1');
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: Role.CUSTOMER }),
    ).rejects.toThrow('Vai trò đã thay đổi, vui lòng đăng nhập lại');
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
