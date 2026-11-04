import { Role } from '@prisma/client';

/**
 * Chuẩn hoá từ khoá tìm đơn thành tiền tố mã đơn (id UUID viết thường).
 * Mọi vai trò hiển thị mã đơn = 8 ký tự ĐẦU của id viết hoa (vd "#358F5744"),
 * nên admin gõ "#358f57", "358F5744" hay cả UUID đều phải tìm ra đơn.
 * Trả về null khi từ khoá không giống mã đơn (tên khách, SĐT…), hoặc quá ngắn (< 4 ký tự)
 * để tránh khớp quá nhiều đơn.
 */
export function parseOrderCodeTerm(term: string | undefined | null): string | null {
  const raw = (term ?? '').trim().replace(/^#/, '').toLowerCase();
  if (raw.length < 4 || raw.length > 36) return null;
  if (!/^[0-9a-f-]+$/.test(raw)) return null;
  // Chuỗi toàn số có thể là SĐT: chỉ coi là mã đơn khi đủ 8 ký tự trở xuống (độ dài mã hiển thị)
  if (/^\d+$/.test(raw) && raw.length > 8) return null;
  return raw;
}

export interface HistoryActorUser {
  id: string;
  fullName: string;
  role: Role;
}

/** Gắn thông tin người đổi trạng thái (tên + vai trò) vào từng dòng lịch sử; null = hệ thống tự động. */
export function attachHistoryActors<T extends { changedBy: string | null }>(
  history: T[],
  users: HistoryActorUser[],
): (T & { actor: HistoryActorUser | null })[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  return history.map((h) => ({ ...h, actor: h.changedBy ? byId.get(h.changedBy) ?? null : null }));
}
