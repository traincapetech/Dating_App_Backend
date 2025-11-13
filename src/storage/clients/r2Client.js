import {S3Client} from '@aws-sdk/client-s3';
import {config} from '../../config/env.js';

let cachedClient;

export function getR2Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const {accountId, accessKeyId, secretAccessKey} = config.r2;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 credentials are not fully configured. Check CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.',
    );
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

export default getR2Client;

