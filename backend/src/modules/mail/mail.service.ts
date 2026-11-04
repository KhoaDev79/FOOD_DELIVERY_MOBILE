import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailContent } from './mail-templates';

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

/** Gửi email qua SMTP (Gmail miễn phí). Thiếu SMTP_USER / SMTP_PASS thì coi như chưa cấu hình. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly cfg?: MailConfig;
  private transporter?: Transporter;

  constructor(config: ConfigService) {
    const cfg = config.get<MailConfig>('mail');
    if (cfg?.user && cfg.pass) this.cfg = cfg;
  }

  isConfigured(): boolean {
    return !!this.cfg;
  }

  async send(to: string, content: MailContent): Promise<void> {
    if (!this.cfg) throw new Error('Chưa cấu hình SMTP');
    this.transporter ??= createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: { user: this.cfg.user, pass: this.cfg.pass },
      // Không treo request quá lâu khi máy chủ mail chậm
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await this.transporter.sendMail({
      from: { name: this.cfg.fromName, address: this.cfg.user },
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }

  /**
   * Gửi nền, không chờ: thời gian phản hồi API không phụ thuộc việc có gửi mail hay không
   * (tránh lộ email nào đã đăng ký qua độ trễ). Lỗi chỉ ghi log, không ghi nội dung mail.
   */
  sendInBackground(to: string, content: MailContent, label: string): void {
    this.send(to, content).catch((err: unknown) => {
      this.logger.error(`Gửi email "${label}" thất bại: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}
