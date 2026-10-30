export interface PeakWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface BusinessConfig {
  deliveryBaseFee: number;
  deliveryFeePerKm: number;
  deliveryFreeKm: number;
  deliveryPeakMultiplier: number;
  deliveryPeakWindowsRaw: string;
  deliveryPeakWindows: PeakWindow[];
  roadDistanceFallbackFactor: number;
  quoteTtlMinutes: number;
  quoteSecret: string;
  platformCommissionRate: number;
  driverDebtLimit: number;
  driverSearchRadiusKm: number;
  driverLocationStaleMinutes: number;
  driverOfflineAfterMinutes: number;
  maxActiveDeliveries: number;
  orderPendingTimeoutMinutes: number;
  orderStalledPickupMinutes: number;
  failedDeliveryMinWaitMinutes: number;
  failedDeliveryMinCalls: number;
  arrivalMaxDistanceM: number;
  customerMaxFailedDeliveries: number;
  reviewWindowDays: number;
  authActiveCacheSeconds: number;
}

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
  business: BusinessConfig;
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

const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QUOTE_SECRET'] as const;

const NUMERIC_BUSINESS_KEYS = [
  'DELIVERY_BASE_FEE',
  'DELIVERY_FEE_PER_KM',
  'DELIVERY_FREE_KM',
  'DELIVERY_PEAK_MULTIPLIER',
  'ROAD_DISTANCE_FALLBACK_FACTOR',
  'QUOTE_TTL_MINUTES',
  'PLATFORM_COMMISSION_RATE',
  'DRIVER_DEBT_LIMIT',
  'DRIVER_SEARCH_RADIUS_KM',
  'DRIVER_LOCATION_STALE_MINUTES',
  'DRIVER_OFFLINE_AFTER_MINUTES',
  'MAX_ACTIVE_DELIVERIES',
  'ORDER_PENDING_TIMEOUT_MINUTES',
  'ORDER_STALLED_PICKUP_MINUTES',
  'FAILED_DELIVERY_MIN_WAIT_MINUTES',
  'FAILED_DELIVERY_MIN_CALLS',
  'ARRIVAL_MAX_DISTANCE_M',
  'CUSTOMER_MAX_FAILED_DELIVERIES',
  'REVIEW_WINDOW_DAYS',
  'AUTH_ACTIVE_CACHE_SECONDS',
] as const;

export function parsePeakWindows(raw: string): PeakWindow[] {
  if (!raw || !raw.trim()) return [];
  const windows: PeakWindow[] = [];
  for (const part of raw.split(',')) {
    const match = part.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const sh = parseInt(match[1], 10);
    const sm = parseInt(match[2], 10);
    const eh = parseInt(match[3], 10);
    const em = parseInt(match[4], 10);
    if (sh >= 0 && sh < 24 && sm >= 0 && sm < 60 && eh >= 0 && eh < 24 && em >= 0 && em < 60) {
      windows.push({ startMinutes: sh * 60 + sm, endMinutes: eh * 60 + em });
    }
  }
  return windows;
}

/** Fail fast khi thiếu biến môi trường bắt buộc hoặc cấu hình số âm (dùng cho ConfigModule.validate). */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QUOTE_SECRET'] as const) {
    if (String(env[k]).length < 32) {
      throw new Error(`${k} must be at least 32 characters`);
    }
  }
  for (const k of NUMERIC_BUSINESS_KEYS) {
    const raw = env[k];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const val = Number(raw);
      if (!Number.isFinite(val) || val < 0) {
        throw new Error(`${k} must be a non-negative number`);
      }
    }
  }
  return env;
}

export default (): AppConfig => {
  const origins = process.env.CORS_ORIGINS ?? '*';
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const deliveryBaseFee = parseInt(process.env.DELIVERY_BASE_FEE ?? '15000', 10);
  const deliveryFeePerKm = parseInt(process.env.DELIVERY_FEE_PER_KM ?? '5000', 10);
  const deliveryFreeKm = parseFloat(process.env.DELIVERY_FREE_KM ?? '2');
  const deliveryPeakWindowsRaw = process.env.DELIVERY_PEAK_WINDOWS ?? '11:00-13:00,17:30-19:30';

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
      baseFee: deliveryBaseFee,
      feePerKm: deliveryFeePerKm,
      freeKm: deliveryFreeKm,
    },
    business: {
      deliveryBaseFee,
      deliveryFeePerKm,
      deliveryFreeKm,
      deliveryPeakMultiplier: parseFloat(process.env.DELIVERY_PEAK_MULTIPLIER ?? '1.2'),
      deliveryPeakWindowsRaw,
      deliveryPeakWindows: parsePeakWindows(deliveryPeakWindowsRaw),
      roadDistanceFallbackFactor: parseFloat(process.env.ROAD_DISTANCE_FALLBACK_FACTOR ?? '1.3'),
      quoteTtlMinutes: parseInt(process.env.QUOTE_TTL_MINUTES ?? '10', 10),
      quoteSecret: (process.env.QUOTE_SECRET ?? 'change_me_quote_secret_at_least_32_chars') as string,
      platformCommissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.2'),
      driverDebtLimit: parseInt(process.env.DRIVER_DEBT_LIMIT ?? '1000000', 10),
      driverSearchRadiusKm: parseFloat(process.env.DRIVER_SEARCH_RADIUS_KM ?? '5'),
      driverLocationStaleMinutes: parseInt(process.env.DRIVER_LOCATION_STALE_MINUTES ?? '5', 10),
      driverOfflineAfterMinutes: parseInt(process.env.DRIVER_OFFLINE_AFTER_MINUTES ?? '15', 10),
      maxActiveDeliveries: parseInt(process.env.MAX_ACTIVE_DELIVERIES ?? '2', 10),
      orderPendingTimeoutMinutes: parseInt(process.env.ORDER_PENDING_TIMEOUT_MINUTES ?? '5', 10),
      orderStalledPickupMinutes: parseInt(process.env.ORDER_STALLED_PICKUP_MINUTES ?? '10', 10),
      failedDeliveryMinWaitMinutes: parseInt(process.env.FAILED_DELIVERY_MIN_WAIT_MINUTES ?? '10', 10),
      failedDeliveryMinCalls: parseInt(process.env.FAILED_DELIVERY_MIN_CALLS ?? '3', 10),
      arrivalMaxDistanceM: parseInt(process.env.ARRIVAL_MAX_DISTANCE_M ?? '200', 10),
      customerMaxFailedDeliveries: parseInt(process.env.CUSTOMER_MAX_FAILED_DELIVERIES ?? '2', 10),
      reviewWindowDays: parseInt(process.env.REVIEW_WINDOW_DAYS ?? '7', 10),
      authActiveCacheSeconds: parseInt(process.env.AUTH_ACTIVE_CACHE_SECONDS ?? '30', 10),
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
