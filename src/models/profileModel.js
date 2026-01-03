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
  
  // Auto-review new profiles
  try {
    const {autoReviewProfile} = await import('../services/moderationService.js');
    const reviewResult = await autoReviewProfile(newProfile);
    
    // Update profile with review status
    const profileIndex = profiles.length - 1;
    profiles[profileIndex] = {
      ...profiles[profileIndex],
      moderationStatus: reviewResult.status,
      moderationFlags: reviewResult.flags,
      moderationRiskScore: reviewResult.riskScore,
      autoReviewedAt: new Date().toISOString(),
    };
    await storage.writeJson(PROFILES_PATH, profiles);
    return profiles[profileIndex];
  } catch (error) {
    console.error('Error in auto-review:', error);
    return newProfile;
  }
}

export async function updateProfile(userId, updates) {
  const profiles = await getProfiles();
  const index = profiles.findIndex(profile => profile.userId === userId);
  if (index === -1) {
    return null;
  }
  
  // updateProfileData already does the deep merge, so updates contains the complete merged data
  // Just save it directly, but preserve id, userId, createdAt
  const existing = profiles[index];
  const updated = {
    id: existing.id,
    userId: existing.userId,
    createdAt: existing.createdAt,
    ...updates, // This already has all merged nested objects from updateProfileData
    updatedAt: new Date().toISOString(),
  };
  
  console.log('[updateProfile] Saving profile with DOB:', updated.basicInfo?.dob, 'Interests:', JSON.stringify(updated.lifestyle?.interests));
  
  profiles[index] = updated;
  await storage.writeJson(PROFILES_PATH, profiles);
  
  // Re-review profile if significant changes (media, bio, prompts)
  const hasSignificantChanges = updates.media || updates.basicInfo?.bio || updates.profilePrompts;
  if (hasSignificantChanges) {
    try {
      const {autoReviewProfile} = await import('../services/moderationService.js');
      const reviewResult = await autoReviewProfile(updated);
      
      profiles[index] = {
        ...profiles[index],
        moderationStatus: reviewResult.status,
        moderationFlags: reviewResult.flags,
        moderationRiskScore: reviewResult.riskScore,
        autoReviewedAt: new Date().toISOString(),
      };
      await storage.writeJson(PROFILES_PATH, profiles);
    } catch (error) {
      console.error('Error in auto-review on update:', error);
    }
  }
  
  // Verify what was actually saved
  const saved = profiles[index];
  console.log('[updateProfile] VERIFIED SAVED - DOB:', saved.basicInfo?.dob, 'Interests:', JSON.stringify(saved.lifestyle?.interests));
  
  return saved;
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

