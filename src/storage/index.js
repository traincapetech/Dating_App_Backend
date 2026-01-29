import {config} from '../config/env.js';
import {localDriver} from './drivers/local.js';
import {r2Driver} from './drivers/r2.js';
import {
  encryptObject,
  decryptObject,
  SENSITIVE_USER_FIELDS,
  SENSITIVE_MESSAGE_FIELDS,
} from '../services/encryptionService.js';

const drivers = {
  local: localDriver,
  r2: r2Driver,
};

function getDriver() {
  const driver = drivers[config.storageDriver];
  if (!driver) {
    const supported = Object.keys(drivers).join('", "');
    throw new Error(
      `Unsupported storage driver "${config.storageDriver}". Supported drivers are "${supported}".`,
    );
  }
  return driver;
}

// Map of file paths to their sensitive fields for automatic encryption
const ENCRYPTED_FILE_FIELDS = {
  'data/users.json': SENSITIVE_USER_FIELDS,
  'data/messages.json': SENSITIVE_MESSAGE_FIELDS,
};

export const storage = {
  async readJson(relativePath, defaultValue = null) {
    const data = await getDriver().readJson(relativePath, defaultValue);
    
    // Auto-decrypt sensitive fields if this file has encryption configured
    const sensitiveFields = ENCRYPTED_FILE_FIELDS[relativePath];
    if (sensitiveFields && Array.isArray(data)) {
      return data.map(item => decryptObject(item, sensitiveFields));
    }
    
    return data;
  },
  async writeJson(relativePath, data) {
    let dataToWrite = data;
    
    // Auto-encrypt sensitive fields if this file has encryption configured
    const sensitiveFields = ENCRYPTED_FILE_FIELDS[relativePath];
    if (sensitiveFields && Array.isArray(data)) {
      dataToWrite = data.map(item => encryptObject(item, sensitiveFields));
    }
    
    return getDriver().writeJson(relativePath, dataToWrite);
  },
  async readFile(relativePath) {
    return getDriver().readFile(relativePath);
  },
  async writeFile(relativePath, buffer, options = {}) {
    return getDriver().writeFile(relativePath, buffer, options);
  },
  async deleteObject(relativePath) {
    return getDriver().deleteObject(relativePath);
  },
  getPublicUrl(relativePath) {
    return getDriver().getPublicUrl?.(relativePath) ?? null;
  },
  /**
   * Upload a file and return its public URL
   * @param {string} relativePath - The path to store the file
   * @param {Buffer} buffer - The file data
   * @param {string} contentType - The MIME type of the file
   * @returns {Promise<{url: string}>}
   */
  async uploadFile(relativePath, buffer, contentType = 'application/octet-stream') {
    const driver = getDriver();
    
    // Write the file
    await driver.writeFile(relativePath, buffer, { contentType });
    
    // Get the public URL
    let url = driver.getPublicUrl?.(relativePath);
    
    // For local storage, construct a local URL
    if (!url && config.storageDriver === 'local') {
      // Local files are served statically - construct URL based on server
      const port = config.port || 3000;
      url = `http://localhost:${port}/uploads/${relativePath}`;
    }
    
    return { url };
  },
  
  /**
   * Read encrypted file with automatic decryption of specified fields
   * For files not in ENCRYPTED_FILE_FIELDS, use this for manual decryption
   */
  async readEncryptedJson(relativePath, sensitiveFields, defaultValue = null) {
    const data = await getDriver().readJson(relativePath, defaultValue);
    
    if (sensitiveFields && Array.isArray(data)) {
      return data.map(item => decryptObject(item, sensitiveFields));
    }
    
    return data;
  },
  
  /**
   * Write data with automatic encryption of specified fields
   * For files not in ENCRYPTED_FILE_FIELDS, use this for manual encryption
   */
  async writeEncryptedJson(relativePath, data, sensitiveFields) {
    let dataToWrite = data;
    
    if (sensitiveFields && Array.isArray(data)) {
      dataToWrite = data.map(item => encryptObject(item, sensitiveFields));
    }
    
    return getDriver().writeJson(relativePath, dataToWrite);
  },
};

export default storage;
export {localDriver} from './drivers/local.js';
export {r2Driver} from './drivers/r2.js';
