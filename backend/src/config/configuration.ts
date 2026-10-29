export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[] | '*';
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  delivery: {
    baseFee: number;
    feePerKm: number;
    freeKm: number;
  };
  vnpay: {
    tmnCode: string;
    hashSecret: string;
    url: string;
    /** URL backend nhận redirect từ VNPay (GET /payments/vnpay/return) */
    returnUrl: string;
    /** Deep link mở lại app sau khi thanh toán */
    mobileRedirect: string;
    /** Thời hạn thanh toán (phút) */
    expireMinutes: number;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  expo: {
    accessToken?: string;
  };
  maps: {
    provider: string;
    goongApiKey?: string;
  };
  sentry: {
    dsn?: string;
  };
}

const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Fail fast khi thiếu biến môi trường bắt buộc (dùng cho ConfigModule.validate). */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (String(env[k]).length < 32) {
      throw new Error(`${k} must be at least 32 characters`);
    }
  }
  return env;
}

export default (): AppConfig => {
  const origins = process.env.CORS_ORIGINS ?? '*';
  const port = parseInt(process.env.PORT ?? '3000', 10);
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    corsOrigins: origins === '*' ? '*' : origins.split(',').map((o) => o.trim()),
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET as string,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET as string,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    },
    delivery: {
      baseFee: parseInt(process.env.DELIVERY_BASE_FEE ?? '15000', 10),
      feePerKm: parseInt(process.env.DELIVERY_FEE_PER_KM ?? '5000', 10),
      freeKm: parseFloat(process.env.DELIVERY_FREE_KM ?? '2'),
    },
    vnpay: {
      tmnCode: process.env.VNPAY_TMN_CODE ?? '',
      hashSecret: process.env.VNPAY_HASH_SECRET ?? '',
      url: process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNPAY_RETURN_URL ?? `http://localhost:${port}/api/v1/payments/vnpay/return`,
      mobileRedirect: process.env.MOBILE_PAYMENT_REDIRECT ?? 'fooddelivery://payment-result',
      expireMinutes: parseInt(process.env.VNPAY_EXPIRE_MINUTES ?? '15', 10),
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    },
    expo: {
      accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    },
    maps: {
      provider: process.env.MAP_PROVIDER || 'nominatim',
      goongApiKey: process.env.GOONG_API_KEY || undefined,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN || undefined,
    },
  };
};
