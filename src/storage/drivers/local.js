import {promises as fs, constants as fsConstants} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');

function resolvePath(relativePath) {
  if (!relativePath) {
    throw new Error('Local storage operations require a relative path.');
  }
  return path.resolve(projectRoot, relativePath);
}

async function ensureDirectory(targetPath) {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, {recursive: true});
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath, defaultValue = null) {
  const fullPath = resolvePath(relativePath);
  if (!(await fileExists(fullPath))) {
    if (defaultValue !== null) {
      await writeJson(relativePath, defaultValue);
      return defaultValue;
    }
    return null;
  }

  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

async function writeJson(relativePath, data) {
  const fullPath = resolvePath(relativePath);
  await ensureDirectory(fullPath);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readFile(relativePath) {
  const fullPath = resolvePath(relativePath);
  if (!(await fileExists(fullPath))) {
    return null;
  }
  return fs.readFile(fullPath);
}

async function writeFile(relativePath, buffer, options = {}) {
  const {encoding} = options;
  const fullPath = resolvePath(relativePath);
  console.log('[Local Driver] Writing file:', {
    relativePath,
    fullPath,
    bufferSize: buffer?.length || 0,
    encoding: encoding || 'binary',
  });
  await ensureDirectory(fullPath);
  await fs.writeFile(fullPath, buffer, encoding);
  console.log('[Local Driver] File saved successfully to:', fullPath);
}

async function deleteObject(relativePath) {
  const fullPath = resolvePath(relativePath);
  if (!(await fileExists(fullPath))) {
    return;
  }
  await fs.unlink(fullPath);
}

export const localDriver = {
  readJson,
  writeJson,
  readFile,
  writeFile,
  deleteObject,
  getPublicUrl: () => null,
};

export default localDriver;

