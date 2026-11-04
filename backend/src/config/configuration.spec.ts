import { sampleSecretsInProduction, validateEnv } from './configuration';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  QUOTE_SECRET: 'c'.repeat(40),
};

describe('validateEnv', () => {
  it('báo thiếu biến bắt buộc và khoá quá ngắn', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: '' })).toThrow('DATABASE_URL');
    expect(() => validateEnv({ ...base, QUOTE_SECRET: 'short' })).toThrow('QUOTE_SECRET');
    expect(validateEnv(base)).toBe(base);
  });
});

describe('sampleSecretsInProduction', () => {
  const sample = { ...base, JWT_ACCESS_SECRET: 'change_me_access_secret_at_least_32_chars' };
  it('chỉ cảnh báo khi production còn dùng khoá mẫu', () => {
    expect(sampleSecretsInProduction({ ...sample, NODE_ENV: 'production' })).toEqual(['JWT_ACCESS_SECRET']);
    expect(sampleSecretsInProduction({ ...sample, NODE_ENV: 'development' })).toEqual([]);
    expect(sampleSecretsInProduction({ ...base, NODE_ENV: 'production' })).toEqual([]);
  });
});
