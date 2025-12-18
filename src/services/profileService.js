import {
  upsertProfile,
  findProfileByUserId,
  updateProfile,
  getProfiles,
} from '../models/profileModel.js';
import {getUsers} from '../models/userModel.js';

function computeAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

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
  const profile = await findProfileByUserId(userId);
  if (!profile) {
    return null;
  }
  
  // Enrich profile with user data and formatted fields (similar to getAllProfiles)
  const users = await getUsers();
  const user = users.find(u => u.id === profile.userId);
  
  // Combine firstName and lastName if fullName is not available
  const fullName = user?.fullName || 
    (profile.basicInfo?.firstName && profile.basicInfo?.lastName 
      ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim()
      : profile.basicInfo?.firstName || profile.basicInfo?.lastName || 'Unknown');
  
  const ageFromDob = computeAge(profile.basicInfo?.dob);

  return {
    ...profile,
    name: fullName,
    email: user?.email || '',
    // Extract age from profile if available
    age: ageFromDob ?? profile.personalDetails?.age ?? profile.basicInfo?.age ?? null,
    // Get photos from media
    photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
    // Get bio from profile prompts (aboutMe.answer or bio) or basic info
    bio: profile.profilePrompts?.aboutMe?.answer || profile.profilePrompts?.bio || profile.basicInfo?.bio || '',
    // Get interests from lifestyle
    interests: profile.lifestyle?.interests || [],
  };
}

export async function updateProfileData(userId, updates) {
  const existing = await findProfileByUserId(userId);
  
  // Deep merge nested objects - ensure all fields are preserved
  const profileData = {
    ...(existing || {}),
    // Deep merge basicInfo - preserve all existing fields
    basicInfo: updates.basicInfo ? {
      ...(existing?.basicInfo || {}),
      ...updates.basicInfo,
    } : (existing?.basicInfo || {}),
    // Deep merge datingPreferences
    datingPreferences: updates.datingPreferences ? {
      ...(existing?.datingPreferences || {}),
      ...updates.datingPreferences,
    } : (existing?.datingPreferences || {}),
    // Deep merge personalDetails
    personalDetails: updates.personalDetails ? {
      ...(existing?.personalDetails || {}),
      ...updates.personalDetails,
    } : (existing?.personalDetails || {}),
    // Deep merge lifestyle - CRITICAL: preserve interests
    lifestyle: updates.lifestyle ? {
      ...(existing?.lifestyle || {}),
      ...updates.lifestyle,
    } : (existing?.lifestyle || {}),
    // Deep merge profilePrompts
    profilePrompts: updates.profilePrompts ? {
      ...(existing?.profilePrompts || {}),
      ...updates.profilePrompts,
    } : (existing?.profilePrompts || {}),
    // Preserve media if not updated
    media: updates.media || existing?.media,
  };
  
  console.log('[updateProfileData] Merged profileData:', JSON.stringify({
    basicInfo: profileData.basicInfo,
    lifestyle: profileData.lifestyle,
  }, null, 2));
  
  return upsertProfile(userId, profileData);
}

export async function getAllProfiles(excludeUserId = null, options = {}) {
  const {useMatching = false, minScore = 0, maxDistance = null, sortBy = 'score', limit = null} = options;
  
  const profiles = await getProfiles();
  const users = await getUsers();

  // Get viewer preferences to filter by gender
  let viewerAllowedGenders = null;
  if (excludeUserId) {
    const viewerProfile = profiles.find(p => p.userId === excludeUserId);
    const whoToDate = viewerProfile?.datingPreferences?.whoToDate || [];
    console.log('[getAllProfiles] Viewer profile whoToDate:', whoToDate, 'for userId:', excludeUserId);
    
    if (whoToDate.length > 0 && !whoToDate.includes('Everyone')) {
      const map = {
        Men: 'Man',
        Women: 'Woman',
        'Nonbinary People': 'Non Binary',
      };
      viewerAllowedGenders = whoToDate
        .map(item => map[item])
        .filter(Boolean);
      console.log('[getAllProfiles] Filtering to genders:', viewerAllowedGenders);
    } else {
      console.log('[getAllProfiles] No gender filter (Everyone or empty)');
    }
  }
  
  // Combine profile data with user data
  let enrichedProfiles = profiles
    .filter(profile => !excludeUserId || profile.userId !== excludeUserId)
    .map(profile => {
      const user = users.find(u => u.id === profile.userId);
      // Combine firstName and lastName if fullName is not available
      const fullName = user?.fullName || 
        (profile.basicInfo?.firstName && profile.basicInfo?.lastName 
          ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim()
          : profile.basicInfo?.firstName || profile.basicInfo?.lastName || 'Unknown');
      
      const ageFromDob = computeAge(profile.basicInfo?.dob);

      return {
        ...profile,
        name: fullName,
        email: user?.email || '',
        // Extract age from profile if available
        age: ageFromDob ?? profile.personalDetails?.age ?? profile.basicInfo?.age ?? null,
        // Get photos from media
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        // Get bio from profile prompts (aboutMe.answer or bio) or basic info
        bio: profile.profilePrompts?.aboutMe?.answer || profile.profilePrompts?.bio || profile.basicInfo?.bio || '',
        // Get interests from lifestyle
        interests: profile.lifestyle?.interests || [],
        // Calculate distance (will be calculated in matching if location data exists)
        distance: null, // Will be set by matching service if location data is available
      };
    })
    // Gender filter based on viewer's preferences
    .filter(profile => {
      if (!viewerAllowedGenders) {
        return true; // No filter, show all
      }
      const gender = profile.basicInfo?.gender;
      if (!gender) {
        // If profile has no gender set, don't show it when viewer has specific preferences
        return false;
      }
      const isAllowed = viewerAllowedGenders.includes(gender);
      if (!isAllowed) {
        console.log('[getAllProfiles] Filtered out:', profile.name, 'Gender:', gender, 'Not in allowed:', viewerAllowedGenders);
      }
      return isAllowed;
    })
    .filter(profile => profile.photos.length > 0); // Only show profiles with photos
  
  // If matching is enabled and we have a user ID, use matching algorithm
  if (useMatching && excludeUserId) {
    try {
      const {getMatchedProfiles} = await import('./matchingService.js');
      const matchedProfiles = await getMatchedProfiles(excludeUserId, {
        minScore,
        maxDistance,
        sortBy,
        limit,
      });
      
      // The matchedProfiles already have all the enriched data, so use them directly
      enrichedProfiles = matchedProfiles;
    } catch (error) {
      console.error('Error applying matching algorithm:', error);
      // Fall back to non-matched profiles if matching fails
    }
  }
  
  return enrichedProfiles;
}

