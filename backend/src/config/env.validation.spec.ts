import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/ai_study_hub',
    FIREBASE_PROJECT_ID: 'project-id',
    FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
    FIREBASE_PRIVATE_KEY: 'private-key',
    GEMINI_API_KEY: 'gemini-key',
  };

  it('applies development defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      R2_PRESIGNED_URL_TTL_SECONDS: 300,
      GEMINI_MOCK: true,
      GEMINI_API_KEYS: '',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_FALLBACK_MODELS: '',
      GEMINI_TIMEOUT_MS: 15000,
      EXTRACTION_TIMEOUT_MS: 240000,
      LLAMA_PARSE_PREMIUM_MODE: false,
      OCR_MAX_PAGES: 20,
      CORS_ORIGIN: 'http://localhost:3000',
      SEPAY_FRONTEND_URL: 'http://localhost:3000',
      SEPAY_ENABLED: false,
      SEPAY_ENV: 'sandbox',
      SEPAY_STUDENT_PRICE_VND: 149000,
      SEPAY_PRO_PRICE_VND: 349000,
      SEPAY_BANK_ACCOUNT: '0123456789',
      SEPAY_BANK_CODE: 'MB',
      SEPAY_BANK_HOLDER_NAME: 'AI STUDY HUB',
    });
  });

  it('rejects a missing database URL', () => {
    const { DATABASE_URL: _databaseUrl, ...environment } = validEnvironment;

    expect(() => validateEnvironment(environment)).toThrow(
      '"DATABASE_URL" is required',
    );
  });

  it('requires R2 credentials and a bucket in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow(
      '"R2_ACCOUNT_ID" is required. "R2_ACCESS_KEY_ID" is required. "R2_SECRET_ACCESS_KEY" is required. "R2_BUCKET_NAME" is required. "R2_ENDPOINT" is required',
    );
  });

  it('allows an empty R2 public URL for private buckets', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        R2_PUBLIC_URL: '',
      }),
    ).toMatchObject({
      R2_PUBLIC_URL: '',
    });
  });

  it('rejects a presigned URL TTL longer than seven days', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        R2_PRESIGNED_URL_TTL_SECONDS: 604801,
      }),
    ).toThrow(
      '"R2_PRESIGNED_URL_TTL_SECONDS" must be less than or equal to 604800',
    );
  });

  it('rejects a non-positive Gemini timeout', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GEMINI_TIMEOUT_MS: 0,
      }),
    ).toThrow('"GEMINI_TIMEOUT_MS" must be a positive number');
  });

  it('rejects a non-positive extraction timeout', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        EXTRACTION_TIMEOUT_MS: 0,
      }),
    ).toThrow('"EXTRACTION_TIMEOUT_MS" must be a positive number');
  });

  it('requires a webhook API key when SePay is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SEPAY_ENABLED: true,
        SEPAY_MERCHANT_ID: 'merchant-id',
        SEPAY_SECRET_KEY: 'secret-key',
      }),
    ).toThrow('"SEPAY_WEBHOOK_API_KEY" is required');
  });
});
