import {
  upsertProfile,
  findProfileByUserId,
  updateProfile,
  getProfiles,
} from '../models/profileModel.js';
import {getUsers} from '../models/userModel.js';

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

export async function getAllProfiles(excludeUserId = null) {
  const profiles = await getProfiles();
  const users = await getUsers();
  
  // Combine profile data with user data
  const enrichedProfiles = profiles
    .filter(profile => !excludeUserId || profile.userId !== excludeUserId)
    .map(profile => {
      const user = users.find(u => u.id === profile.userId);
      return {
        ...profile,
        name: user?.fullName || 'Unknown',
        email: user?.email || '',
        // Extract age from profile if available
        age: profile.personalDetails?.age || profile.basicInfo?.age || null,
        // Get photos from media
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        // Get bio from profile prompts or basic info
        bio: profile.profilePrompts?.bio || profile.basicInfo?.bio || '',
        // Get interests from lifestyle
        interests: profile.lifestyle?.interests || [],
        // Calculate distance (mock for now, can be enhanced with location)
        distance: Math.floor(Math.random() * 10) + 1,
      };
    })
    .filter(profile => profile.photos.length > 0); // Only show profiles with photos
  
  return enrichedProfiles;
}

