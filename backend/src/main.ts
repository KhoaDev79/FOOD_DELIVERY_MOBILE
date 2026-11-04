import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

export const GLOBAL_PREFIX = 'api/v1';

export function globalValidationPipe() {
  return new ValidationPipe({
    whitelist: true, // loại bỏ field không khai báo trong DTO
    forbidNonWhitelisted: true, // ...và báo lỗi nếu client cố gửi (vd: "price", "role": "ADMIN")
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
}

async function bootstrap() {
  // TODO(phase 2): Sentry.init({ dsn: process.env.SENTRY_DSN }) trước khi tạo app
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const corsOrigins = config.get<string[] | '*'>('corsOrigins') ?? '*';
  // Link chia sẻ /s/r/:id, /s/d/:id để ngắn gọn, không nằm dưới /api/v1
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [
      { path: 's/r/:id', method: RequestMethod.GET },
      { path: 's/d/:id', method: RequestMethod.GET },
    ],
  });
  // Sau reverse proxy (Caddy/Nginx) phải bật để req.ip là IP thật của người dùng (giới hạn tần suất theo IP)
  app.set('trust proxy', config.get('security.trustProxy') ?? false);
  app.enableCors({ origin: corsOrigins === '*' ? true : corsOrigins, credentials: true });
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });
  app.useGlobalPipes(globalValidationPipe());
  app.enableShutdownHooks();

  // Phục vụ tệp tĩnh (ảnh quán ăn, món ăn, avatar cục bộ) không phụ thuộc Internet
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public/' });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready at http://localhost:${port}/${GLOBAL_PREFIX}`, 'Bootstrap');
}

bootstrap();
