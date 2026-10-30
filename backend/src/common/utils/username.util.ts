import { Prisma } from '@prisma/client';

type UserLookup = { user: Pick<Prisma.TransactionClient['user'], 'findUnique'> };

/** Chuẩn hoá tên đăng nhập: chữ thường, chỉ giữ a-z, 0-9, dấu chấm và gạch dưới. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
}

/**
 * Sinh tên đăng nhập chưa ai dùng từ email: phần trước @ ("an.nguyen@gmail.com" → "an.nguyen").
 * Trùng thì thêm số phía sau ("an.nguyen2", "an.nguyen3"...).
 */
export async function generateUniqueUsername(db: UserLookup, email: string): Promise<string> {
  const base = normalizeUsername(email.split('@')[0] ?? '') || 'user';
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
}
