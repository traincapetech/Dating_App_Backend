/**
 * profileService.js (server)
 * ─────────────────────────────────────────────────────────────────────────────
 * Simplified service layer. All writes go through updateProfileData.
 * Legacy per-section save functions removed completely.
 */
import {
  upsertProfile,
  findProfileByUserId,
  getProfiles,
} from '../models/profileModel.js';
import {getUsers} from '../models/userModel.js';
import {resolveDisplayName} from '../utils/nameUtils.js';
import Like from '../models/Like.js';
import Pass from '../models/Pass.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';

function computeAge(dob) {
  if (!dob) return null;
  let birthDate = new Date(dob);

  if (Number.isNaN(birthDate.getTime()) && typeof dob === 'string') {
    if (dob.length === 8 && /^\d+$/.test(dob)) {
      birthDate = new Date(
        `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`,
      );
    } else {
      const parts = dob.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else if (parts[0].length === 4 && parseInt(parts[1]) > 12) {
          birthDate = new Date(`${parts[0]}-${parts[2]}-${parts[1]}`);
        }
      }
    }
  }

  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

/**
 * updateProfileData — The ONLY write function.
 * Performs a safe deep-merge of the incoming partial `updates` object
 * into the existing profile document, then persists.
 */
export async function updateProfileData(userId, updates) {
  const existing = await findProfileByUserId(userId);

  const profileData = {
    ...(existing || {}),
    basicInfo: updates.basicInfo
      ? {...(existing?.basicInfo || {}), ...updates.basicInfo}
      : existing?.basicInfo || {},
    datingPreferences: updates.datingPreferences
      ? {...(existing?.datingPreferences || {}), ...updates.datingPreferences}
      : existing?.datingPreferences || {},
    personalDetails: updates.personalDetails
      ? {...(existing?.personalDetails || {}), ...updates.personalDetails}
      : existing?.personalDetails || {},
    lifestyle: updates.lifestyle
      ? {...(existing?.lifestyle || {}), ...updates.lifestyle}
      : existing?.lifestyle || {},
    profilePrompts: updates.profilePrompts
      ? {...(existing?.profilePrompts || {}), ...updates.profilePrompts}
      : existing?.profilePrompts || {},
    media: updates.media || existing?.media,
    isPaused: updates.isPaused !== undefined ? updates.isPaused : existing?.isPaused,
    isHidden: updates.isHidden !== undefined ? updates.isHidden : existing?.isHidden,
  };

  return upsertProfile(userId, profileData);
}

export async function getProfile(userId, viewerId = null) {
  const profile = await findProfileByUserId(userId);
  const users = await getUsers();
  const user = users.find(u => (u._id || u.id) === userId);
  
  if (!profile) {
    if (!user) return null; // Truly not found
    
    // Return a skeleton profile if document doesn't exist yet
    const skeletonProfile = {
      userId,
      basicInfo: {
        firstName: user.fullName ? user.fullName.split(' ')[0] : 'User',
        lastName: user.fullName ? user.fullName.split(' ').slice(1).join(' ') : '',
      },
      datingPreferences: { whoToDate: ['Everyone'] },
      personalDetails: {},
      lifestyle: { interests: [] },
      profilePrompts: {},
      media: { media: [] },
      isPaused: false,
    };
    
    return {
      ...skeletonProfile,
      name: user.fullName || 'User',
      email: user.email || '',
      isVerified: user.isVerified || false,
      showOnlineStatus: user.showOnlineStatus !== false,
      isActiveToday: true,
      age: null,
      photos: [],
      bio: '',
      interests: [],
      stats: { likes: 0, matches: 0, views: 0 },
      interaction: { isLiked: false, isMatched: false, hasChat: false }
    };
  }

  const [likesCount, matchesCount, interaction] = await Promise.all([
    Like.countDocuments({receiverId: userId}),
    Match.countDocuments({users: userId}),
    viewerId && viewerId !== userId
      ? (async () => {
          const [likeSent, match, message] = await Promise.all([
            Like.findOne({senderId: viewerId, receiverId: userId}),
            Match.findOne({users: {$all: [viewerId, userId]}}),
            Message.findOne({
              $or: [
                {senderId: viewerId, receiverId: userId},
                {senderId: userId, receiverId: viewerId},
              ],
            }),
          ]);
          return {isLiked: !!likeSent, isMatched: !!match, hasChat: !!message};
        })()
      : Promise.resolve(null),
  ]);

  const displayName = resolveDisplayName(profile, user);
  const ageFromDob = computeAge(profile.basicInfo?.dob);
  const isActiveToday =
    user?.showOnlineStatus &&
    user?.lastActive &&
    Date.now() - new Date(user.lastActive).getTime() < 24 * 60 * 60 * 1000;

  return {
    ...profile,
    name: displayName,
    email: user?.email || '',
    isVerified: user?.isVerified || false,
    showOnlineStatus: user?.showOnlineStatus !== false,
    isActiveToday: !!isActiveToday,
    age:
      ageFromDob ??
      profile.personalDetails?.age ??
      profile.basicInfo?.age ??
      null,
    photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
    bio:
      profile.profilePrompts?.aboutMe?.answer ||
      profile.profilePrompts?.bio ||
      profile.basicInfo?.bio ||
      '',
    interests: profile.lifestyle?.interests || [],
    stats: {
      likes: likesCount,
      matches: matchesCount,
      views: profile.views || 0,
    },
    interaction: interaction || {isLiked: false, isMatched: false, hasChat: false},
  };
}

function parseHeight(heightStr) {
  if (!heightStr) return null;
  const cmMatch = heightStr.match(/(\d+)\s*cm/i);
  if (cmMatch) return parseFloat(cmMatch[1]);
  const feetInchMatch = heightStr.match(/(\d+)'(\d+)"/);
  if (feetInchMatch) {
    return parseFloat(feetInchMatch[1]) * 30.48 + parseFloat(feetInchMatch[2]) * 2.54;
  }
  const numberMatch = heightStr.match(/(\d+)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
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

  let swipedUserIds = [];
  if (excludeUserId) {
    const [likes, passes, matches] = await Promise.all([
      Like.find({senderId: excludeUserId}, 'receiverId'),
      Pass.find({userId: excludeUserId}, 'passedUserId'),
      Match.find({users: excludeUserId, status: {$ne: 'expired'}}, 'users'),
    ]);
    swipedUserIds = [
      ...likes.map(l => l.receiverId),
      ...passes.map(p => p.passedUserId),
      ...matches.map(m => m.users.find(u => u !== excludeUserId)),
    ];
  }

  let viewerAllowedGenders = null;
  if (excludeUserId) {
    const viewerProfile = profiles.find(p => p.userId === excludeUserId);
    const whoToDate = viewerProfile?.datingPreferences?.whoToDate || [];
    if (whoToDate.length > 0 && !whoToDate.includes('Everyone')) {
      const map = {Men: 'Man', Women: 'Woman', 'Nonbinary People': 'Non Binary'};
      viewerAllowedGenders = whoToDate.map(item => map[item]).filter(Boolean);
    }
  }

  let enrichedProfiles = profiles
    .filter(profile => {
      if (excludeUserId && profile.userId === excludeUserId) return false;
      if (profile.isPaused || profile.isHidden) return false;
      return true;
    })
    .map(profile => {
      const user = users.find(u => (u._id || u.id) === profile.userId);
      const displayName = resolveDisplayName(profile, user);
      const ageFromDob = computeAge(profile.basicInfo?.dob);
      const isActiveToday =
        user?.showOnlineStatus &&
        user?.lastActive &&
        Date.now() - new Date(user.lastActive).getTime() < 24 * 60 * 60 * 1000;
      return {
        ...profile,
        name: displayName,
        email: user?.email || '',
        isActiveToday: !!isActiveToday,
        age: ageFromDob ?? profile.personalDetails?.age ?? profile.basicInfo?.age ?? null,
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        bio:
          profile.profilePrompts?.aboutMe?.answer ||
          profile.profilePrompts?.bio ||
          profile.basicInfo?.bio ||
          '',
        interests: profile.lifestyle?.interests || [],
        distance: null,
      };
    })
    .filter(profile => {
      if (!viewerAllowedGenders) return true;
      const gender = profile.basicInfo?.gender;
      if (!gender) return false;
      return viewerAllowedGenders.includes(gender);
    })
    .filter(profile => profile.photos.length > 0);

  const applyAdvancedFilters = profileList => {
    if (!filters) return profileList;
    return profileList.filter(profile => {
      if (filters.educationLevel) {
        const e = profile.personalDetails?.educationLevel;
        if (!e || e !== filters.educationLevel) return false;
      }
      if (filters.minHeight || filters.maxHeight) {
        const h = parseHeight(profile.personalDetails?.height);
        if (h === null) return false;
        if (filters.minHeight && h < filters.minHeight) return false;
        if (filters.maxHeight && h > filters.maxHeight) return false;
      }
      if (filters.drink && profile.lifestyle?.drink !== filters.drink) return false;
      if (filters.smokeTobacco && profile.lifestyle?.smokeTobacco !== filters.smokeTobacco) return false;
      if (filters.smokeWeed && profile.lifestyle?.smokeWeed !== filters.smokeWeed) return false;
      if (filters.religiousBeliefs && profile.lifestyle?.religiousBeliefs !== filters.religiousBeliefs) return false;
      if (filters.politicalBeliefs && profile.lifestyle?.politicalBeliefs !== filters.politicalBeliefs) return false;
      return true;
    });
  };

  if ((useMatching || maxDistance !== null) && excludeUserId) {
    try {
      const {getMatchedProfiles} = await import('./matchingService.js');
      const matchedProfiles = await getMatchedProfiles(excludeUserId, {
        minScore,
        maxDistance,
        sortBy,
        limit,
      });
      enrichedProfiles = applyAdvancedFilters(matchedProfiles);
    } catch (error) {
      console.error('Error applying matching/distance algorithm:', error);
      enrichedProfiles = applyAdvancedFilters(enrichedProfiles);
    }
  } else {
    enrichedProfiles = applyAdvancedFilters(enrichedProfiles);
  }

  return enrichedProfiles;
}
