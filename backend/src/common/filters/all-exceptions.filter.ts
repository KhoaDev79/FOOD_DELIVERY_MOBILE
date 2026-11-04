import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Bắt mọi exception và trả về format thống nhất:
 * { success: false, statusCode, message, errors?, path, timestamp }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown;
    let code: string | undefined;
    let retryAfterSec: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { message?: string | string[]; code?: unknown; retryAfterSec?: unknown };
        // Mã lỗi nghiệp vụ (vd RATE_LIMITED, CANCEL_LIMIT) để app xử lý riêng, không phải dò theo câu chữ
        if (typeof b.code === 'string') code = b.code;
        if (typeof b.retryAfterSec === 'number') retryAfterSec = b.retryAfterSec;
        if (Array.isArray(b.message)) {
          // Lỗi kiểm tra dữ liệu: đưa lý do cụ thể (đã viết tiếng Việt trong DTO) lên message để app hiển thị
          message = b.message.join('. ');
          errors = b.message;
        } else {
          message = b.message ?? exception.message;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = `Giá trị đã tồn tại: ${(exception.meta?.target as string[] | undefined)?.join(', ') ?? 'unique field'}`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Không tìm thấy bản ghi';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Tham chiếu không hợp lệ';
          break;
      }
    }

    if (status >= 500) {
      // TODO(phase 2): Sentry.captureException(exception)
      this.logger.error(
        `${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (retryAfterSec !== undefined) res.setHeader('Retry-After', String(retryAfterSec));

    res.status(status).json({
      success: false,
      statusCode: status,
      ...(code ? { code } : {}),
      ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
      message,
      ...(errors ? { errors } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
