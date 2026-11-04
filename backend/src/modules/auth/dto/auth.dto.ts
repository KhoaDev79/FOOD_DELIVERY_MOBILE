import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { transformOptionalPhone, VN_MOBILE_REGEX } from '../../../common/utils/phone.util';

/** Bỏ khoảng trắng đầu/cuối và gộp nhiều dấu cách liên tiếp thành một. */
const collapseSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * Đăng ký tài khoản: luôn là KHÁCH HÀNG. Muốn làm chủ quán/tài xế thì gửi yêu cầu nâng cấp vai trò.
 * Trường thừa (vd. "role") bị từ chối bởi ValidationPipe (forbidNonWhitelisted).
 */
export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(254, { message: 'Email quá dài' })
  email: string;

  @IsString({ message: 'Vui lòng nhập mật khẩu' })
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/\S/, { message: 'Mật khẩu không được chỉ gồm dấu cách' })
  password: string;

  @Transform(collapseSpaces)
  @IsString({ message: 'Vui lòng nhập họ tên' })
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  @Matches(/\p{L}/u, { message: 'Họ tên phải có chữ cái' })
  fullName: string;

  /**
   * Bắt buộc: tài xế/quán cần gọi được khách khi giao hàng.
   * "0912 345 678", "+84912345678"... đều được lưu thành "0912345678"; chuỗi rỗng coi như chưa nhập.
   */
  @Transform(({ value }) => transformOptionalPhone(value))
  @IsString({ message: 'Vui lòng nhập số điện thoại' })
  @Matches(VN_MOBILE_REGEX, { message: 'Số điện thoại di động không hợp lệ (10 số, vd. 0912345678)' })
  phone: string;
}

export class LoginDto {
  /** Tên đăng nhập (hoặc email). Bắt buộc nếu không gửi `email`. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString({ message: 'Vui lòng nhập tên đăng nhập' })
  @MinLength(1, { message: 'Vui lòng nhập tên đăng nhập' })
  @MaxLength(254)
  username?: string;

  /** Giữ để tương thích với client cũ đăng nhập bằng email. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(254, { message: 'Email quá dài' })
  email: string;
}

export class VerifyResetOtpDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(254, { message: 'Email quá dài' })
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsString({ message: 'Vui lòng nhập mã xác nhận' })
  @Matches(/^\d{6}$/, { message: 'Mã xác nhận gồm 6 chữ số' })
  otp: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resetToken: string;

  /** Cùng quy tắc với lúc đăng ký */
  @IsString({ message: 'Vui lòng nhập mật khẩu mới' })
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/\S/, { message: 'Mật khẩu không được chỉ gồm dấu cách' })
  newPassword: string;
}

export class GoogleLoginDto {
  /** idToken (JWT) Google trả cho app sau khi người dùng chọn tài khoản */
  @IsString({ message: 'Thiếu mã xác thực Google' })
  @MinLength(20, { message: 'Mã xác thực Google không hợp lệ' })
  @MaxLength(4096, { message: 'Mã xác thực Google không hợp lệ' })
  idToken: string;
}
