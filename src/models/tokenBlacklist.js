import {storage} from '../storage/index.js';

const TOKEN_BLACKLIST_PATH = 'data/tokenBlacklist.json';

/**
 * Get all blacklisted tokens
 */
export async function getBlacklistedTokens() {
  return storage.readJson(TOKEN_BLACKLIST_PATH, []);
}

/**
 * Add token to blacklist
 */
export async function blacklistToken(token, userId, expiresAt) {
  const blacklist = await getBlacklistedTokens();
  blacklist.push({
    token,
    userId,
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
    blacklistedAt: new Date().toISOString(),
  });
  await storage.writeJson(TOKEN_BLACKLIST_PATH, blacklist);
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token) {
  const blacklist = await getBlacklistedTokens();
  const now = new Date();

  // Remove expired tokens
  const validBlacklist = blacklist.filter(item => {
    const expiresAt = new Date(item.expiresAt);
    return expiresAt > now;
  });

  // Update blacklist if we removed expired tokens
  if (validBlacklist.length !== blacklist.length) {
    await storage.writeJson(TOKEN_BLACKLIST_PATH, validBlacklist);
  }

  return validBlacklist.some(item => item.token === token);
}

/**
 * Blacklist all tokens for a user (logout from all devices)
 */
export async function blacklistAllUserTokens(userId) {
  // Store a token version in user model instead
  // This is more efficient than storing individual tokens
  const {updateUser} = await import('./userModel.js');
  const user = await updateUser(userId, {
    tokenVersion: (Date.now() / 1000).toString(), // Unix timestamp as version
  });
  return user;
}

/**
 * Get user's token version
 */
export async function getUserTokenVersion(userId) {
  const {findUserById} = await import('./userModel.js');
  const user = await findUserById(userId);
  return user?.tokenVersion || '0';
}

