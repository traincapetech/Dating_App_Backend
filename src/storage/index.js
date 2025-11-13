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
};

export default storage;
export {localDriver} from './drivers/local.js';
export {r2Driver} from './drivers/r2.js';

