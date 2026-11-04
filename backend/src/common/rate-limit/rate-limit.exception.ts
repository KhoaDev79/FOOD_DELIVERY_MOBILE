import { HttpException, HttpStatus } from '@nestjs/common';

/** 429 kèm `code` và số giây chờ, để app hiển thị và để bộ lọc lỗi đặt header Retry-After. */
export class RateLimitedException extends HttpException {
  constructor(message: string, retryAfterSec: number) {
    super({ code: 'RATE_LIMITED', message, retryAfterSec }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
