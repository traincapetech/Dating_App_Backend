import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This ensures .env is loaded from the /server directory
dotenv.config({path: path.join(__dirname, '../../.env')});

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-prod') {
    throw new Error('FATAL: JWT_SECRET must be set to a strong secret in production.');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'refresh-secret') {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be set to a strong secret in production.');
  }
}

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    'dev-only-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
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
