import {storage} from '../storage/index.js';

const PROFILES_PATH = 'data/profiles.json';

export async function getProfiles() {
  return storage.readJson(PROFILES_PATH, []);
}

export async function findProfileByUserId(userId) {
  const profiles = await getProfiles();
  return profiles.find(profile => profile.userId === userId);
}

export async function createProfile(profileData) {
  const profiles = await getProfiles();
  const newProfile = {
    id: profileData.id || `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: profileData.userId,
    ...profileData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  profiles.push(newProfile);
  await storage.writeJson(PROFILES_PATH, profiles);
  return newProfile;
}

export async function updateProfile(userId, updates) {
  const profiles = await getProfiles();
  const index = profiles.findIndex(profile => profile.userId === userId);
  if (index === -1) {
    return null;
  }
  profiles[index] = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await storage.writeJson(PROFILES_PATH, profiles);
  return profiles[index];
}

export async function upsertProfile(userId, profileData) {
  const existing = await findProfileByUserId(userId);
  if (existing) {
    return updateProfile(userId, profileData);
  }
  return createProfile({...profileData, userId});
}

export async function deleteProfile(userId) {
  const profiles = await getProfiles();
  const filtered = profiles.filter(profile => profile.userId !== userId);
  await storage.writeJson(PROFILES_PATH, filtered);
  return true;
}

