import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh-secret',
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
    provider: process.env.EMAIL_PROVIDER || 'smtp', // 'emailjs', 'resend', or 'smtp'
    // EmailJS configuration
    emailjsServiceId: process.env.EMAILJS_SERVICE_ID,
    emailjsTemplateId: process.env.EMAILJS_TEMPLATE_ID,
    emailjsPublicKey: process.env.EMAILJS_PUBLIC_KEY,
    emailjsPrivateKey: process.env.EMAILJS_PRIVATE_KEY,
    // Resend configuration
    resendApiKey: process.env.RESEND_API_KEY,
    // Use sales@traincapetech.in (requires domain verification in Resend)
    resendFrom: process.env.EMAIL_FROM || 'Pryvo <sales@traincapetech.in>',
    // SMTP configuration (fallback)
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: Number.parseInt(process.env.EMAIL_PORT || '465', 10),
    // Auto-detect secure: true for 465, false for 587 (STARTTLS)
    secure: process.env.EMAIL_SECURE !== undefined 
      ? process.env.EMAIL_SECURE !== 'false'
      : Number.parseInt(process.env.EMAIL_PORT || '465', 10) === 465,
    user: process.env.EMAIL_USER || 'sales@traincapetech.in',
    password: process.env.EMAIL_PASSWORD || 'Canada@1212',
    from: process.env.EMAIL_FROM || 'Pryvo <sales@traincapetech.in>',
  },
};

export default config;

