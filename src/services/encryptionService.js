/**
 * Encryption Service for Data at Rest
 * Uses AES-256-GCM for authenticated encryption
 *
 * Encrypts sensitive user data before storage
 */

import crypto from 'crypto';
import { config } from '../config/env.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

/**
 * Get or generate encryption key from environment
 * Key should be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey() {
  // Use environment variable or derive from JWT secret
  const keySource = process.env.ENCRYPTION_KEY || config.jwtSecret;

  if (!keySource) {
    throw new Error('No encryption key configured. Set ENCRYPTION_KEY in environment.');
  }

  // Derive a 256-bit key from the source using PBKDF2
  return crypto.pbkdf2Sync(
    keySource,
    'pryvo-encryption-salt',
    100000,
    32,
    'sha256'
  );
}

/**
 * Encrypt a string value
 * @param {string} plaintext - Text to encrypt
 * @returns {string} - Encrypted string in format: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:ciphertext format
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - Encrypted string in format: iv:authTag:ciphertext
 * @returns {string} - Decrypted plaintext
 */
export function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData;
  }

  // Check if data is encrypted (contains our format separator)
  if (!encryptedData.includes(':')) {
    // Data is not encrypted, return as-is (for backward compatibility)
    return encryptedData;
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Invalid format, return as-is
      return encryptedData;
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    // Return original if decryption fails (might be unencrypted data)
    return encryptedData;
  }
}

/**
 * Encrypt an object's sensitive fields
 * @param {object} data - Object with fields to encrypt
 * @param {string[]} sensitiveFields - Fields to encrypt
 * @returns {object} - Object with encrypted fields
 */
export function encryptObject(data, sensitiveFields) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };

  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field]);
    }
  }

  return result;
}

/**
 * Decrypt an object's encrypted fields
 * @param {object} data - Object with encrypted fields
 * @param {string[]} encryptedFields - Fields to decrypt
 * @returns {object} - Object with decrypted fields
 */
export function decryptObject(data, encryptedFields) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };

  for (const field of encryptedFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]);
    }
  }

  return result;
}

/**
 * Hash sensitive data (one-way, for tokens/passwords)
 * @param {string} data - Data to hash
 * @returns {string} - Hashed string
 */
export function hashData(data) {
  if (!data) return null;
  return crypto
    .createHash('sha256')
    .update(data + (config.jwtSecret || 'salt'))
    .digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} - Random hex token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Sensitive fields that should be encrypted in storage
export const SENSITIVE_USER_FIELDS = [
  'phoneNumber',
  'fcmToken',
];

export const SENSITIVE_MESSAGE_FIELDS = [
  'content',
  'mediaUrl',
];

export default {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  hashData,
  generateSecureToken,
  SENSITIVE_USER_FIELDS,
  SENSITIVE_MESSAGE_FIELDS,
};
