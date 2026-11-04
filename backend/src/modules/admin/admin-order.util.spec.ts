import { Role } from '@prisma/client';
import { attachHistoryActors, parseOrderCodeTerm } from './admin-order.util';

describe('parseOrderCodeTerm', () => {
  it('nhận mã 8 ký tự viết hoa, có hoặc không có dấu #', () => {
    expect(parseOrderCodeTerm('#358F5744')).toBe('358f5744');
    expect(parseOrderCodeTerm('358f5744')).toBe('358f5744');
  });

  it('nhận một phần mã (từ 4 ký tự) và cả UUID đầy đủ', () => {
    expect(parseOrderCodeTerm('358f')).toBe('358f');
    expect(parseOrderCodeTerm('358f5744-1a2b-4c3d-8e9f-001122334455')).toBe('358f5744-1a2b-4c3d-8e9f-001122334455');
  });

  it('bỏ qua từ khoá không phải mã đơn', () => {
    expect(parseOrderCodeTerm('Nguyễn Văn A')).toBeNull();
    expect(parseOrderCodeTerm('Phở')).toBeNull();
    expect(parseOrderCodeTerm('ab')).toBeNull();
    expect(parseOrderCodeTerm('')).toBeNull();
    expect(parseOrderCodeTerm(undefined)).toBeNull();
  });

  it('chuỗi số dài hơn 8 ký tự được coi là SĐT, không phải mã đơn', () => {
    expect(parseOrderCodeTerm('0901234567')).toBeNull();
    expect(parseOrderCodeTerm('12345678')).toBe('12345678');
  });
});

describe('attachHistoryActors', () => {
  it('gắn tên + vai trò, người không tìm thấy hoặc hệ thống thì actor = null', () => {
    const users = [{ id: 'u1', fullName: 'Ryan', role: Role.DRIVER }];
    const res = attachHistoryActors(
      [
        { id: 'h1', changedBy: 'u1' },
        { id: 'h2', changedBy: null },
        { id: 'h3', changedBy: 'deleted' },
      ],
      users,
    );
    expect(res.map((h) => h.actor?.fullName ?? null)).toEqual(['Ryan', null, null]);
    expect(res[0].actor?.role).toBe(Role.DRIVER);
  });
});
