import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyResetOtpDto,
} from './dto/auth.dto';
import { GoogleAuthService } from './google-auth.service';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  /** Đăng nhập / đăng ký bằng Google: gửi idToken; tài khoản mới trả isNewUser = true. */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(@Body() dto: GoogleLoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.googleAuth.login(dto.idToken, ip, userAgent);
  }

  @Public()
  @RateLimit('REGISTER_IP')
  @Post('register')
  register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.register(dto, userAgent);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(dto, userAgent, ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** Đăng xuất thiết bị này: gửi refresh token để thu hồi đúng phiên (thiết bị khác vẫn đăng nhập). */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto) {
    await this.auth.logout(dto.refreshToken);
  }

  /** Quên mật khẩu bước 1: gửi mã OTP 6 số tới email (phản hồi như nhau dù email có tồn tại hay không). */
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ip: string) {
    return this.passwordReset.requestOtp(dto.email, ip);
  }

  /** Bước 2: kiểm tra mã, đúng thì trả resetToken (hiệu lực 10 phút). */
  @Public()
  @Post('password/verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyResetOtp(@Body() dto: VerifyResetOtpDto, @Ip() ip: string) {
    return this.passwordReset.verifyOtp(dto.email, dto.otp, ip);
  }

  /** Bước 3: đặt mật khẩu mới; đăng xuất mọi thiết bị. */
  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto.resetToken, dto.newPassword);
  }
}
