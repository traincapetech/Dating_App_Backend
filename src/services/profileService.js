import {
  upsertProfile,
  findProfileByUserId,
  updateProfile,
} from '../models/profileModel.js';

export async function saveBasicInfo(userId, basicInfo) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    basicInfo: {
      ...(existing?.basicInfo || {}),
      ...basicInfo,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function saveDatingPreferences(userId, preferences) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    datingPreferences: {
      ...(existing?.datingPreferences || {}),
      ...preferences,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function savePersonalDetails(userId, details) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    personalDetails: {
      ...(existing?.personalDetails || {}),
      ...details,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function saveLifestyle(userId, lifestyle) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    lifestyle: {
      ...(existing?.lifestyle || {}),
      ...lifestyle,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function saveProfilePrompts(userId, prompts) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    profilePrompts: {
      ...(existing?.profilePrompts || {}),
      ...prompts,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function saveMedia(userId, media) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    media: {
      ...(existing?.media || {}),
      ...media,
    },
  };
  return upsertProfile(userId, profileData);
}

export async function getProfile(userId) {
  return findProfileByUserId(userId);
}

export async function updateProfileData(userId, updates) {
  const existing = await findProfileByUserId(userId);
  const profileData = {
    ...(existing || {}),
    ...updates,
  };
  return upsertProfile(userId, profileData);
}

