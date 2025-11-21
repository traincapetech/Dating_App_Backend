import {storage} from '../storage/index.js';

const NOTIFICATION_TOKENS_PATH = 'data/notificationTokens.json';

export async function getNotificationTokens() {
  return storage.readJson(NOTIFICATION_TOKENS_PATH, []);
}

export async function findTokenByUserId(userId) {
  const tokens = await getNotificationTokens();
  return tokens.find(token => token.userId === userId);
}

export async function findTokenByDeviceToken(deviceToken) {
  const tokens = await getNotificationTokens();
  return tokens.find(token => token.deviceToken === deviceToken);
}

export async function registerToken(userId, deviceToken, platform = 'unknown') {
  const tokens = await getNotificationTokens();
  
  // Remove existing token for this user if exists
  const filtered = tokens.filter(token => token.userId !== userId);
  
  const tokenData = {
    userId,
    deviceToken,
    platform,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  filtered.push(tokenData);
  await storage.writeJson(NOTIFICATION_TOKENS_PATH, filtered);
  return tokenData;
}

export async function unregisterToken(userId) {
  const tokens = await getNotificationTokens();
  const filtered = tokens.filter(token => token.userId !== userId);
  await storage.writeJson(NOTIFICATION_TOKENS_PATH, filtered);
  return true;
}

export async function getTokensByUserIds(userIds) {
  const tokens = await getNotificationTokens();
  return tokens.filter(token => userIds.includes(token.userId));
}

