import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    'refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  saltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  r2: {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET,
    prefix: process.env.CLOUDFLARE_R2_PREFIX || '',
    publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '',
  },
  email: {
    // Provider: 'brevo' (recommended), 'smtp' (custom)
    provider: process.env.EMAIL_PROVIDER || 'brevo',
    // Brevo configuration
    brevoApiKey: process.env.BREVO_API_KEY || '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@pryvo.com',
    brevoSenderName: process.env.BREVO_SENDER_NAME || 'Pryvo',
    // SMTP configuration (fallback)
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: Number.parseInt(process.env.EMAIL_PORT || '465', 10),
    secure:
      process.env.EMAIL_SECURE !== undefined
        ? process.env.EMAIL_SECURE !== 'false'
        : Number.parseInt(process.env.EMAIL_PORT || '465', 10) === 465,
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'Pryvo',
  },
};

export default config;
