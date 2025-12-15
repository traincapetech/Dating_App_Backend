import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {config} from '../../config/env.js';
import {getR2Client} from '../clients/r2Client.js';

function ensureBucketConfigured() {
  if (!config.r2.bucket) {
    throw new Error(
      'Cloudflare R2 bucket is not configured. Set CLOUDFLARE_R2_BUCKET.',
    );
  }
}

function resolveKey(relativePath) {
  if (!relativePath) {
    throw new Error('Cloudflare R2 operations require a key path.');
  }
  const {prefix = ''} = config.r2;
  return `${prefix}${relativePath}`.replace(/^\/+/, '');
}

async function readJson(relativePath, defaultValue = null) {
  ensureBucketConfigured();
  const client = getR2Client();
  const key = resolveKey(relativePath);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
      }),
    );
    const content = await response.Body?.transformToString();
    if (!content) {
      return defaultValue;
    }
    return JSON.parse(content);
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === 'NoSuchKey') {
      if (defaultValue !== null) {
        await writeJson(relativePath, defaultValue);
        return defaultValue;
      }
      return null;
    }
    throw error;
  }
}

async function writeJson(relativePath, data) {
  ensureBucketConfigured();
  const client = getR2Client();
  const key = resolveKey(relativePath);

  await client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }),
  );
}

async function readFile(relativePath) {
  ensureBucketConfigured();
  const client = getR2Client();
  const key = resolveKey(relativePath);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
      }),
    );
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

async function writeFile(relativePath, buffer, options = {}) {
  ensureBucketConfigured();
  const client = getR2Client();
  const key = resolveKey(relativePath);

  const {contentType, cacheControl, metadata} = options;

  console.log('[R2 Driver] Writing file:', {
    relativePath,
    resolvedKey: key,
    bucket: config.r2.bucket,
    contentType,
    bufferSize: buffer?.length || 0,
    prefix: config.r2.prefix || '(none)',
  });

  try {
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
      Metadata: metadata,
    }),
  );
    console.log('[R2 Driver] File uploaded successfully to R2:', key);
  } catch (error) {
    console.error('[R2 Driver] Error uploading to R2:', {
      message: error.message,
      code: error.code,
      name: error.name,
      key,
      bucket: config.r2.bucket,
    });
    throw error;
  }
}

async function deleteObject(relativePath) {
  ensureBucketConfigured();
  const client = getR2Client();
  const key = resolveKey(relativePath);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
    }),
  );
}

function getPublicUrl(relativePath) {
  if (!config.r2.publicBaseUrl) {
    return null;
  }
  const key = resolveKey(relativePath);
  return `${config.r2.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
}

export const r2Driver = {
  readJson,
  writeJson,
  readFile,
  writeFile,
  deleteObject,
  getPublicUrl,
};

export default r2Driver;

