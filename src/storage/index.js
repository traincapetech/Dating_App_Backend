import {config} from '../config/env.js';
import {localDriver} from './drivers/local.js';
import {r2Driver} from './drivers/r2.js';

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

export const storage = {
  async readJson(relativePath, defaultValue = null) {
    return getDriver().readJson(relativePath, defaultValue);
  },
  async writeJson(relativePath, data) {
    return getDriver().writeJson(relativePath, data);
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
};

export default storage;
export {localDriver} from './drivers/local.js';
export {r2Driver} from './drivers/r2.js';
