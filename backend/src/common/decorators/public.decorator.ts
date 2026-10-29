import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Bỏ qua JwtAuthGuard toàn cục cho route này. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
