import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitedException } from './rate-limit.exception';
import { RateLimitGuard, rateLimitSubject } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

const configWith = (enabled?: boolean) => ({ get: jest.fn(() => enabled) }) as never;

describe('RateLimitService', () => {
  it('chặn khi vượt giới hạn, trả 429 kèm code và số giây chờ', () => {
    const svc = new RateLimitService(configWith(true));
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) svc.consume('ORDER_CREATE', 'user-1', `key-${i}`, now);

    let error: unknown;
    try {
      svc.consume('ORDER_CREATE', 'user-1', 'key-6', now + 60_000);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(RateLimitedException);
    const ex = error as RateLimitedException;
    expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    // Cửa sổ 10 phút, đã trôi 1 phút → còn 9 phút
    expect(ex.getResponse()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Bạn đặt quá nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau 9 phút.',
      retryAfterSec: 540,
    });
  });

  it('mỗi người dùng một bộ đếm riêng; reset xoá bộ đếm', () => {
    const svc = new RateLimitService(configWith(true));
    for (let i = 0; i < 5; i++) svc.record('LOGIN_FAIL_ACCOUNT_IP', 'a|ip');
    expect(svc.status('LOGIN_FAIL_ACCOUNT_IP', 'a|ip').blocked).toBe(true);
    expect(svc.status('LOGIN_FAIL_ACCOUNT_IP', 'b|ip').blocked).toBe(false);
    svc.reset('LOGIN_FAIL_ACCOUNT_IP', 'a|ip');
    expect(svc.status('LOGIN_FAIL_ACCOUNT_IP', 'a|ip').blocked).toBe(false);
  });

  it('RATE_LIMIT_ENABLED=false thì không chặn gì', () => {
    const svc = new RateLimitService(configWith(false));
    for (let i = 0; i < 20; i++) svc.consume('ORDER_CREATE', 'user-1');
    expect(svc.status('ORDER_CREATE', 'user-1').blocked).toBe(false);
  });
});

describe('RateLimitGuard', () => {
  const makeContext = (req: object) =>
    ({
      getType: () => 'http',
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  it('đếm theo id người dùng nếu đã đăng nhập, ngược lại theo IP', () => {
    expect(rateLimitSubject({ ip: '1.2.3.4', user: { id: 'u1' } })).toBe('u:u1');
    expect(rateLimitSubject({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('áp lưới chung API và mức riêng của route; bị chặn ở mức riêng thì không tốn lượt API', () => {
    const svc = new RateLimitService(configWith(true));
    const reflector = { getAllAndOverride: jest.fn((key: string) => (key === 'rateLimitPolicies' ? ['REGISTER_IP'] : undefined)) };
    const guard = new RateLimitGuard(reflector as unknown as Reflector, svc);
    const ctx = makeContext({ ip: '9.9.9.9' });

    for (let i = 0; i < 10; i++) expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(RateLimitedException);
    expect(svc.status('API', 'ip:9.9.9.9').remaining).toBe(600 - 10);
  });

  it('bỏ qua route gắn @SkipRateLimit', () => {
    const svc = new RateLimitService(configWith(true));
    const reflector = { getAllAndOverride: jest.fn((key: string) => key === 'skipRateLimit') };
    const guard = new RateLimitGuard(reflector as unknown as Reflector, svc);
    guard.canActivate(makeContext({ ip: '9.9.9.9' }));
    expect(svc.status('API', 'ip:9.9.9.9').remaining).toBe(600);
  });
});
