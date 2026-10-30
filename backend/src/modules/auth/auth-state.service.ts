import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CachedUserAuthState {
  isActive: boolean;
  role: Role;
  expiresAt: number;
}

/**
 * Kiểm tra trạng thái hoạt động và vai trò hiện tại của tài khoản.
 * Cache ngắn hạn trong bộ nhớ theo AUTH_ACTIVE_CACHE_SECONDS (mặc định 30s),
 * hỗ trợ invalidate(userId) tức thời khi Admin khoá tài khoản hoặc đổi vai trò.
 */
@Injectable()
export class AuthStateService {
  private readonly cache = new Map<string, CachedUserAuthState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getUserState(userId: string): Promise<{ isActive: boolean; role: Role } | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) {
      return { isActive: cached.isActive, role: cached.role };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: true },
    });
    if (!user) {
      this.cache.delete(userId);
      return null;
    }

    const ttlSeconds = this.config.get<number>('business.authActiveCacheSeconds') ?? 30;
    this.cache.set(userId, {
      isActive: user.isActive,
      role: user.role,
      expiresAt: now + ttlSeconds * 1000,
    });
    return { isActive: user.isActive, role: user.role };
  }

  async isActive(userId: string): Promise<boolean> {
    const state = await this.getUserState(userId);
    return Boolean(state?.isActive);
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}

