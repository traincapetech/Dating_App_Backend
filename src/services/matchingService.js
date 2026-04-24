import Profile from '../models/Profile.js';
import User from '../models/User.js';
import {hasActiveBoost} from './boostService.js';

function computeAge(dob) {
  if (!dob) return null;
  let birthDate = new Date(dob);

  if (Number.isNaN(birthDate.getTime()) && typeof dob === 'string') {
    // try YYYYMMDD
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
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0 || age > 120) return null;

  return age;
}

/**
 * Calculate compatibility score between two profiles
 * @param {object} currentUserProfile - Current user's profile
 * @param {object} otherProfile - Other user's profile
 * @param {number} distance - Pre-calculated distance from DB (in km)
 * @returns {object} Match result with score and details
 */
export function calculateCompatibilityScore(
  currentUserProfile,
  otherProfile,
  distance = null,
) {
  let score = 0;
  let maxScore = 0;
  const details = {
    genderMatch: false,
    intentionMatch: false,
    relationshipTypeMatch: false,
    lifestyleMatch: 0,
    familyPlansMatch: false,
    distance: distance,
    distanceScore: 0,
    interestsOverlap: 0,
    starSignMatch: false,
    educationMatch: false,
    languageMatch: false,
  };

  const currentUser = currentUserProfile;
  const other = otherProfile;

  // 1. Gender/WhoToDate compatibility (Essential - 30 points)
  maxScore += 30;
  details.genderMatch = true;
  score += 30;

  // 2. Dating intention compatibility (20 points)
  maxScore += 20;
  const userIntention = currentUser.datingPreferences?.datingIntention;
  const otherIntention = other.datingPreferences?.datingIntention;
  if (userIntention && otherIntention) {
    if (userIntention === otherIntention) {
      score += 20;
      details.intentionMatch = true;
    } else if (
      (userIntention.includes('Long-term') &&
        otherIntention.includes('Long-term')) ||
      (userIntention.includes('Short-term') &&
        otherIntention.includes('Short-term'))
    ) {
      score += 15;
      details.intentionMatch = true;
    } else if (
      userIntention.includes('open to') ||
      otherIntention.includes('open to') ||
      userIntention === 'Figuring out my dating goals' ||
      otherIntention === 'Figuring out my dating goals'
    ) {
      score += 10;
    }
  }

  // 3. Relationship type compatibility (15 points)
  maxScore += 15;
  const userRelationshipType = currentUser.datingPreferences?.relationshipType;
  const otherRelationshipType = other.datingPreferences?.relationshipType;
  if (userRelationshipType && otherRelationshipType) {
    if (userRelationshipType === otherRelationshipType) {
      score += 15;
      details.relationshipTypeMatch = true;
    }
  }

  // 4. Lifestyle compatibility (15 points)
  maxScore += 15;
  let lifestyleMatches = 0;
  const lifestyleFields = [
    'drink',
    'smokeTobacco',
    'smokeWeed',
    'drugs',
    'politicalBeliefs',
    'religiousBeliefs',
  ];
  let lifestyleFieldsCount = 0;

  lifestyleFields.forEach(field => {
    const userValue = currentUser.lifestyle?.[field];
    const otherValue = other.lifestyle?.[field];

    if (
      userValue &&
      otherValue &&
      userValue !== 'Prefer not to say' &&
      otherValue !== 'Prefer not to say'
    ) {
      lifestyleFieldsCount++;
      if (userValue === otherValue) {
        lifestyleMatches++;
      }
    }
  });

  if (lifestyleFieldsCount > 0) {
    const lifestyleScore = (lifestyleMatches / lifestyleFieldsCount) * 15;
    score += lifestyleScore;
    details.lifestyleMatch = lifestyleMatches / lifestyleFieldsCount;
  }

  // 5. Family plans compatibility (10 points)
  maxScore += 10;
  const userFamilyPlans = currentUser.personalDetails?.familyPlans;
  const otherFamilyPlans = other.personalDetails?.familyPlans;
  if (userFamilyPlans && otherFamilyPlans) {
    if (userFamilyPlans === otherFamilyPlans) {
      score += 10;
      details.familyPlansMatch = true;
    } else if (
      (userFamilyPlans === 'Want children' &&
        otherFamilyPlans === 'Want children') ||
      (userFamilyPlans === "Don't want children" &&
        otherFamilyPlans === "Don't want children")
    ) {
      score += 10;
      details.familyPlansMatch = true;
    } else if (
      userFamilyPlans === 'Not sure yet' ||
      otherFamilyPlans === 'Not sure yet'
    ) {
      score += 5;
    }
  }

  // 6. Interests Overlap (25 points) - The "Vibe" factor
  maxScore += 25;
  const userInterests = currentUser.lifestyle?.interests || [];
  const otherInterests = other.lifestyle?.interests || [];
  if (userInterests.length > 0 && otherInterests.length > 0) {
    const commonInterests = userInterests.filter(interest =>
      otherInterests.some(i => i.toLowerCase() === interest.toLowerCase()),
    );
    if (commonInterests.length > 0) {
      // More than 3 common interests is a strong match
      const overlapScore = Math.min((commonInterests.length / 3) * 25, 25);
      score += overlapScore;
      details.interestsOverlap = commonInterests.length;
    }
  }

  // 7. Education Match (5 points)
  maxScore += 5;
  const userEdu = currentUser.personalDetails?.educationLevel;
  const otherEdu = other.personalDetails?.educationLevel;
  if (userEdu && otherEdu && userEdu === otherEdu) {
    score += 5;
    details.educationMatch = true;
  }

  // 8. Language Match (5 points)
  maxScore += 5;
  const userLangs = currentUser.personalDetails?.languages || [];
  const otherLangs = other.personalDetails?.languages || [];
  if (userLangs.length > 0 && otherLangs.length > 0) {
    const commonLangs = userLangs.filter(lang =>
      otherLangs.some(l => l.toLowerCase() === lang.toLowerCase()),
    );
    if (commonLangs.length > 0) {
      score += 5;
      details.languageMatch = true;
    }
  }

  // 9. Star Sign Compatibility (5 points) - Fun factor
  maxScore += 5;
  const userSign = currentUser.personalDetails?.starSign?.toLowerCase();
  const otherSign = other.personalDetails?.starSign?.toLowerCase();
  if (userSign && otherSign) {
    // Basic compatibility: same sign or complementary signs
    const compatibleSigns = {
      aries: ['leo', 'sagittarius', 'gemini', 'libra'],
      taurus: ['virgo', 'capricorn', 'cancer', 'scorpio'],
      gemini: ['libra', 'aquarius', 'aries', 'leo'],
      cancer: ['scorpio', 'pisces', 'taurus', 'virgo'],
      leo: ['aries', 'sagittarius', 'gemini', 'libra'],
      virgo: ['taurus', 'capricorn', 'cancer', 'scorpio'],
      libra: ['gemini', 'aquarius', 'aries', 'leo'],
      scorpio: ['cancer', 'pisces', 'taurus', 'virgo'],
      sagittarius: ['aries', 'leo', 'libra', 'aquarius'],
      capricorn: ['taurus', 'virgo', 'scorpio', 'pisces'],
      aquarius: ['gemini', 'libra', 'sagittarius', 'aries'],
      pisces: ['cancer', 'scorpio', 'taurus', 'capricorn'],
    };

    if (
      userSign === otherSign ||
      compatibleSigns[userSign]?.includes(otherSign)
    ) {
      score += 5;
      details.starSignMatch = true;
    }
  }

  // 10. Distance score (bonus points, up to 10 points)
  maxScore += 10;
  if (distance !== null) {
    if (distance < 5) {
      details.distanceScore = 10;
      score += 10;
    } else if (distance < 15) {
      details.distanceScore = 7;
      score += 7;
    } else if (distance < 30) {
      details.distanceScore = 4;
      score += 4;
    }
  }

  const percentage =
    maxScore > 0 ? Math.min(Math.round((score / maxScore) * 100), 100) : 0;

  return {
    score,
    maxScore,
    percentage,
    details,
    passed: true,
  };
}

/**
 * Get matched profiles for a user with compatibility scores using MongoDB Aggregation
 * @param {string} userId - Current user's ID
 * @param {object} options - Matching options
 * @returns {Promise<array>} Array of matched profiles with scores
 */
export async function getMatchedProfiles(userId, options = {}) {
  const {
    minScore = 0,
    maxDistance = null, // No default distance limit unless specified
    sortBy = 'score',
    limit = 50,
    excludeUserIds = [],
  } = options;

  // 1. Get current user's profile to understand preferences
  const currentUserProfile = await Profile.findOne({userId});
  if (!currentUserProfile) {
    return [];
  }

  // 2. Build Aggregation Pipeline
  const pipeline = [];

  // A. Geo-Spatial Filter ($geoNear must be first)
  const viewerCoords = currentUserProfile.location?.coordinates;
  // Enforce valid location check (Single Source of Truth)
  const hasViewerLocation =
    viewerCoords &&
    Array.isArray(viewerCoords) &&
    viewerCoords.length === 2 &&
    !(viewerCoords[0] === 0 && viewerCoords[1] === 0);

  if (!hasViewerLocation) {
    console.log(
      `[getMatchedProfiles] User ${userId} has no valid location. Blocking discovery to prevent global leak.`,
    );
    return []; // STRICT: No location = No profiles
  }

  // Determine explicit radius (Convert KM to Meters)
  // Fix: If maxDistance is explicitly provided, it should override the 'Global' setting
  const isGlobal = currentUserProfile.datingPreferences?.global === true;
  const radiusInMeters = (maxDistance && maxDistance > 0) 
    ? maxDistance * 1000 
    : (isGlobal ? null : (maxDistance || 100) * 1000);

  const queryExclusions = [userId, ...excludeUserIds];

  const geoNearOptions = {
    near: currentUserProfile.location,
    distanceField: 'dist.calculated',
    distanceMultiplier: 0.001, // Convert results to km
    spherical: true,
    query: {
      userId: {$nin: queryExclusions},
      isPaused: {$ne: true},
      isHidden: {$ne: true},
      // IMPORTANT: Ensure we only match profiles with valid coordinates
      'location.coordinates': {$exists: true, $ne: [0, 0]},
    },
  };

  if (radiusInMeters) {
    geoNearOptions.maxDistance = radiusInMeters;
  }

  pipeline.push({$geoNear: geoNearOptions});

  // B. Gender Filter
  const userGender = currentUserProfile.basicInfo?.gender;
  const userWhoToDate = currentUserProfile.datingPreferences?.whoToDate || [
    'Everyone',
  ];

  const genderMap = {
    Man: 'Men',
    Woman: 'Women',
    'Non Binary': 'Nonbinary People',
  };
  const reverseGenderMap = {
    Men: 'Man',
    Women: 'Woman',
    'Nonbinary People': 'Non Binary',
  };

  const genderQueries = [];

  // Who does user want to date?
  if (!userWhoToDate.includes('Everyone')) {
    const preferredGenders = userWhoToDate.map(g => reverseGenderMap[g] || g);
    genderQueries.push({'basicInfo.gender': {$in: preferredGenders}});
  }

  // Who wants to date the user?
  // We need profiles where `datingPreferences.whoToDate` includes user's gender mapped (or Everyone)
  const myGenderMapped = genderMap[userGender];
  if (myGenderMapped) {
    genderQueries.push({
      $or: [
        {'datingPreferences.whoToDate': 'Everyone'},
        {'datingPreferences.whoToDate': myGenderMapped},
      ],
    });
  }

  if (genderQueries.length > 0) {
    pipeline.push({$match: {$and: genderQueries}});
  }

  // C. Age Filter (if configured)
  const ageRange = currentUserProfile.datingPreferences?.ageRange;
  if (ageRange) {
    // We don't store age directly usually, but DOB. Calculations in aggregation are complex.
    // For now, let's filter in JS or add a simple check if age is pre-calculated/stored.
    // Or simply do nothing here and let JS handle it, or rely on `matchingService` doing it.
    // But we can approximate using DOB.
    // Let's skip complex date math in Aggregation for this iteration to reduce risk,
    // as DOB format might vary (string vs date).
  }

  // D. Join with User data (lookup) to get email/name if missing
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
    },
  });
  pipeline.push({$unwind: {path: '$user', preserveNullAndEmptyArrays: true}});

  // Execute Aggregation
  const potentialMatches = await Profile.aggregate(pipeline);

  // 3. Post-process: Scoring and additional filtering (Age, etc.)
  const processedMatches = await Promise.all(
    potentialMatches.map(async profile => {
      // Reconstitute profile object for helper functions if needed, or just pass plain object
      // `calculateCompatibilityScore` expects standard profile structure.
      // Aggregation result is POJO, which is fine.

      const distance = profile.dist?.calculated || null;

      const matchResult = calculateCompatibilityScore(
        currentUserProfile.toObject(),
        profile,
        distance,
      );

      const hasBoost = await hasActiveBoost(profile.userId);

      const profileName = `${profile.basicInfo?.firstName || ''} ${
        profile.basicInfo?.lastName || ''
      }`.trim();
      const displayName = profileName || profile.user?.fullName || 'Unknown';

      return {
        ...profile,
        // Map fields for frontend
        name: displayName,
        email: profile.user?.email || '',
        id: profile._id, // Ensure ID is mapped
        age:
          computeAge(profile.basicInfo?.dob) ??
          profile.personalDetails?.age ??
          profile.basicInfo?.age ??
          null,
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        bio: profile.profilePrompts?.bio || profile.basicInfo?.bio || '',
        interests: profile.lifestyle?.interests || [],

        matchScore: matchResult.score,
        matchPercentage: matchResult.percentage,
        matchDetails: matchResult.details,
        isBoosted: hasBoost,
        distance: distance,
      };
    }),
  );

  // 4. Sort and Limit
  const finalMatches = processedMatches
    .filter(p => p.matchPercentage >= minScore)
    .sort((a, b) => {
      if (a.isBoosted && !b.isBoosted) return -1;
      if (!a.isBoosted && b.isBoosted) return 1;

      switch (sortBy) {
        case 'score':
          return b.matchPercentage - a.matchPercentage;
        case 'distance':
          return (a.distance || 99999) - (b.distance || 99999);
        case 'recent':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return b.matchPercentage - a.matchPercentage;
      }
    });

  // Mark the top profile as "Most Compatible" if it has a high enough score (e.g. > 80%)
  if (finalMatches.length > 0 && finalMatches[0].matchPercentage >= 70) {
    finalMatches[0].isMostCompatible = true;
  }

  if (limit && limit > 0) {
    return finalMatches.slice(0, limit);
  }

  return finalMatches;
}
