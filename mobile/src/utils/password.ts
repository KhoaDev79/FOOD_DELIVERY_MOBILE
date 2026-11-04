export type PasswordLevel = 0 | 1 | 2 | 3;

export interface PasswordStrength {
  /** 0 = chưa nhập, 1 = yếu, 2 = trung bình, 3 = mạnh */
  level: PasswordLevel;
  label: string;
  /** Gợi ý ngắn để mật khẩu mạnh hơn; rỗng khi đã mạnh. */
  tip: string;
}

/**
 * Đánh giá độ mạnh mật khẩu để hiện thanh màu dưới ô nhập (chỉ để gợi ý, không chặn đăng ký:
 * quy tắc bắt buộc vẫn là tối thiểu 8 ký tự như backend).
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { level: 0, label: '', tip: '' };
  if (pw.length < 8) return { level: 1, label: 'Yếu', tip: `Thêm ${8 - pw.length} ký tự nữa` };

  let score = 0;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;

  if (score >= 3) return { level: 3, label: 'Mạnh', tip: '' };
  if (score >= 1) {
    return { level: 2, label: 'Trung bình', tip: 'Thêm chữ hoa, số hoặc ký tự đặc biệt để mạnh hơn' };
  }
  return { level: 1, label: 'Yếu', tip: 'Nên kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt' };
}
