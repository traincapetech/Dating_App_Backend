import {
  upsertProfile,
  findProfileByUserId,
  updateProfile,
  getProfiles,
} from '../models/profileModel.js';
import {getUsers} from '../models/userModel.js';
import Like from '../models/Like.js';
import Pass from '../models/Pass.js';
import Match from '../models/Match.js';

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
  const fullName =
    user?.fullName ||
    (profile.basicInfo?.firstName && profile.basicInfo?.lastName
      ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim()
      : profile.basicInfo?.firstName ||
        profile.basicInfo?.lastName ||
        'Unknown');

  const ageFromDob = computeAge(profile.basicInfo?.dob);

  return {
    ...profile,
    name: fullName,
    email: user?.email || '',
    // Extract age from profile if available
    age:
      ageFromDob ??
      profile.personalDetails?.age ??
      profile.basicInfo?.age ??
      null,
    // Get photos from media
    photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
    // Get bio from profile prompts (aboutMe.answer or bio) or basic info
    bio:
      profile.profilePrompts?.aboutMe?.answer ||
      profile.profilePrompts?.bio ||
      profile.basicInfo?.bio ||
      '',
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
    basicInfo: updates.basicInfo
      ? {
          ...(existing?.basicInfo || {}),
          ...updates.basicInfo,
        }
      : existing?.basicInfo || {},
    // Deep merge datingPreferences
    datingPreferences: updates.datingPreferences
      ? {
          ...(existing?.datingPreferences || {}),
          ...updates.datingPreferences,
        }
      : existing?.datingPreferences || {},
    // Deep merge personalDetails
    personalDetails: updates.personalDetails
      ? {
          ...(existing?.personalDetails || {}),
          ...updates.personalDetails,
        }
      : existing?.personalDetails || {},
    // Deep merge lifestyle - CRITICAL: preserve interests
    lifestyle: updates.lifestyle
      ? {
          ...(existing?.lifestyle || {}),
          ...updates.lifestyle,
        }
      : existing?.lifestyle || {},
    // Deep merge profilePrompts
    profilePrompts: updates.profilePrompts
      ? {
          ...(existing?.profilePrompts || {}),
          ...updates.profilePrompts,
        }
      : existing?.profilePrompts || {},
    // Preserve media if not updated
    media: updates.media || existing?.media,
    // Handle pause/hide status
    isPaused:
      updates.isPaused !== undefined ? updates.isPaused : existing?.isPaused,
    isHidden:
      updates.isHidden !== undefined ? updates.isHidden : existing?.isHidden,
  };

  console.log(
    '[updateProfileData] Merged profileData:',
    JSON.stringify(
      {
        basicInfo: profileData.basicInfo,
        lifestyle: profileData.lifestyle,
        isPaused: profileData.isPaused,
      },
      null,
      2,
    ),
  );

  return upsertProfile(userId, profileData);
}

// Helper function to parse height string to number (cm)
function parseHeight(heightStr) {
  if (!heightStr) return null;
  // Try to extract number from string like "5'10\"", "180 cm", "180cm", etc.
  const cmMatch = heightStr.match(/(\d+)\s*cm/i);
  if (cmMatch) {
    return parseFloat(cmMatch[1]);
  }
  const feetInchMatch = heightStr.match(/(\d+)'(\d+)"/);
  if (feetInchMatch) {
    const feet = parseFloat(feetInchMatch[1]);
    const inches = parseFloat(feetInchMatch[2]);
    return feet * 30.48 + inches * 2.54; // Convert to cm
  }
  const numberMatch = heightStr.match(/(\d+)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
    // If number is less than 10, assume it's feet, otherwise assume cm
    return num < 10 ? num * 30.48 : num;
  }
  return null;
}

export async function getAllProfiles(excludeUserId = null, options = {}) {
  const {
    useMatching = false,
    minScore = 0,
    maxDistance = null,
    sortBy = 'score',
    limit = null,
    filters = null,
  } = options;

  const profiles = await getProfiles();
  const users = await getUsers();

  // Get users already swiped by this user
  let swipedUserIds = [];
  if (excludeUserId) {
    const [likes, passes, matches] = await Promise.all([
      Like.find({senderId: excludeUserId}, 'receiverId'),
      Pass.find({userId: excludeUserId}, 'passedUserId'),
      Match.find({users: excludeUserId}, 'users'),
    ]);
    swipedUserIds = [
      ...likes.map(l => l.receiverId),
      ...passes.map(p => p.passedUserId),
      ...matches.map(m => m.users.find(u => u !== excludeUserId)),
    ];
  }

  // Get viewer preferences to filter by gender
  let viewerAllowedGenders = null;
  if (excludeUserId) {
    const viewerProfile = profiles.find(p => p.userId === excludeUserId);
    const whoToDate = viewerProfile?.datingPreferences?.whoToDate || [];
    console.log(
      '[getAllProfiles] Viewer profile whoToDate:',
      whoToDate,
      'for userId:',
      excludeUserId,
    );

    if (whoToDate.length > 0 && !whoToDate.includes('Everyone')) {
      const map = {
        Men: 'Man',
        Women: 'Woman',
        'Nonbinary People': 'Non Binary',
      };
      viewerAllowedGenders = whoToDate.map(item => map[item]).filter(Boolean);
      console.log(
        '[getAllProfiles] Filtering to genders:',
        viewerAllowedGenders,
      );
    } else {
      console.log('[getAllProfiles] No gender filter (Everyone or empty)');
    }
  }

  // Combine profile data with user data
  let enrichedProfiles = profiles
    .filter(profile => {
      // Exclude current user
      if (excludeUserId && profile.userId === excludeUserId) return false;
      // Exclude already swiped users
      if (swipedUserIds.includes(profile.userId)) return false;
      // Exclude paused/hidden profiles
      if (profile.isPaused || profile.isHidden) return false;
      return true;
    })
    .map(profile => {
      const user = users.find(u => u.id === profile.userId);
      // Combine firstName and lastName if fullName is not available
      const fullName =
        user?.fullName ||
        (profile.basicInfo?.firstName && profile.basicInfo?.lastName
          ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim()
          : profile.basicInfo?.firstName ||
            profile.basicInfo?.lastName ||
            'Unknown');

      const ageFromDob = computeAge(profile.basicInfo?.dob);

      return {
        ...profile,
        name: fullName,
        email: user?.email || '',
        // Extract age from profile if available
        age:
          ageFromDob ??
          profile.personalDetails?.age ??
          profile.basicInfo?.age ??
          null,
        // Get photos from media
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        // Get bio from profile prompts (aboutMe.answer or bio) or basic info
        bio:
          profile.profilePrompts?.aboutMe?.answer ||
          profile.profilePrompts?.bio ||
          profile.basicInfo?.bio ||
          '',
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
        console.log(
          '[getAllProfiles] Filtered out:',
          profile.name,
          'Gender:',
          gender,
          'Not in allowed:',
          viewerAllowedGenders,
        );
      }
      return isAllowed;
    })
    .filter(profile => profile.photos.length > 0) // Only show profiles with photos
    // Apply advanced filters (premium feature)
    .filter(profile => {
      if (!filters) return true;

      // Education level filter
      if (filters.educationLevel) {
        const profileEducation = profile.personalDetails?.educationLevel;
        if (!profileEducation || profileEducation !== filters.educationLevel) {
          return false;
        }
      }

      // Height filter
      if (filters.minHeight || filters.maxHeight) {
        const profileHeight = parseHeight(profile.personalDetails?.height);
        if (profileHeight === null) {
          return false; // Strict: if filtering by height, exclude those with no height
        }
        if (filters.minHeight && profileHeight < filters.minHeight) {
          return false;
        }
        if (filters.maxHeight && profileHeight > filters.maxHeight) {
          return false;
        }
      }

      // Lifestyle filters
      if (filters.drink) {
        const profileDrink = profile.lifestyle?.drink;
        if (!profileDrink || profileDrink !== filters.drink) {
          return false;
        }
      }

      if (filters.smokeTobacco) {
        const profileSmoke = profile.lifestyle?.smokeTobacco;
        if (!profileSmoke || profileSmoke !== filters.smokeTobacco) {
          return false;
        }
      }

      if (filters.smokeWeed) {
        const profileWeed = profile.lifestyle?.smokeWeed;
        if (!profileWeed || profileWeed !== filters.smokeWeed) {
          return false;
        }
      }

      if (filters.religiousBeliefs) {
        const profileReligion = profile.lifestyle?.religiousBeliefs;
        if (!profileReligion || profileReligion !== filters.religiousBeliefs) {
          return false;
        }
      }

      if (filters.politicalBeliefs) {
        const profilePolitics = profile.lifestyle?.politicalBeliefs;
        if (!profilePolitics || profilePolitics !== filters.politicalBeliefs) {
          return false;
        }
      }

      return true;
    });

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
