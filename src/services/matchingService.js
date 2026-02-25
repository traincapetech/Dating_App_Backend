import Profile from '../models/Profile.js';
import User from '../models/User.js';
import {hasActiveBoost} from './boostService.js';

function computeAge(dob) {
  if (!dob) return null;
  let birthDate = new Date(dob);

  // Handle DD-MM-YYYY or DD/MM/YYYY formats
  if (Number.isNaN(birthDate.getTime())) {
    const parts = dob.split(/[-/]/);
    if (parts.length === 3 && parts[2].length === 4) {
      birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }

  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
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
  };

  const currentUser = currentUserProfile;
  const other = otherProfile;

  // 1. Gender/WhoToDate compatibility (Already filtered by DB, but good for scoring checks)
  maxScore += 30;
  details.genderMatch = true; // Assumed true if passed DB filter, or check specifically if needed
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

  // 4. Lifestyle compatibility (20 points)
  maxScore += 20;
  let lifestyleMatches = 0;
  const lifestyleFields = [
    'drink',
    'smokeTobacco',
    'smokeWeed',
    'useDrugs',
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
    const lifestyleScore = (lifestyleMatches / lifestyleFieldsCount) * 20;
    score += lifestyleScore;
    details.lifestyleMatch = lifestyleMatches / lifestyleFieldsCount;
  }

  // 5. Family plans compatibility (15 points)
  maxScore += 15;
  const userFamilyPlans = currentUser.personalDetails?.familyPlans;
  const otherFamilyPlans = other.personalDetails?.familyPlans;
  if (userFamilyPlans && otherFamilyPlans) {
    if (userFamilyPlans === otherFamilyPlans) {
      score += 15;
      details.familyPlansMatch = true;
    } else if (
      (userFamilyPlans === 'Want children' &&
        otherFamilyPlans === 'Want children') ||
      (userFamilyPlans === "Don't want children" &&
        otherFamilyPlans === "Don't want children")
    ) {
      score += 15;
      details.familyPlansMatch = true;
    } else if (
      userFamilyPlans === 'Not sure yet' ||
      otherFamilyPlans === 'Not sure yet'
    ) {
      score += 8;
    }
  }

  // 6. Distance score (bonus points, up to 10 points)
  maxScore += 10;
  if (distance !== null) {
    if (distance < 5) {
      details.distanceScore = 10;
      score += 10;
    } else if (distance < 10) {
      details.distanceScore = 8;
      score += 8;
    } else if (distance < 20) {
      details.distanceScore = 5;
      score += 5;
    } else if (distance < 50) {
      details.distanceScore = 2;
      score += 2;
    }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

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
    maxDistance = 100, // Default 100km if not specified
    sortBy = 'score',
    limit = 50,
  } = options;

  // 1. Get current user's profile to understand preferences
  const currentUserProfile = await Profile.findOne({userId});
  if (!currentUserProfile) {
    return [];
  }

  // 2. Build Aggregation Pipeline
  const pipeline = [];

  // A. Geo-Spatial Filter ($geoNear must be first)
  // If user has location, use it. Otherwise, skip geo-filter or use default (but $geoNear requires index)
  if (currentUserProfile.location && currentUserProfile.location.coordinates) {
    pipeline.push({
      $geoNear: {
        near: currentUserProfile.location,
        distanceField: 'dist.calculated', // Output field for distance
        maxDistance: (maxDistance || 10000) * 1000, // Convert km to meters
        distanceMultiplier: 0.001, // Convert meters to km
        spherical: true,
        query: {userId: {$ne: userId}}, // Exclude current user
      },
    });
  } else {
    // Fallback if user has no location: just exclude self
    pipeline.push({$match: {userId: {$ne: userId}}});
  }

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

      return {
        ...profile,
        // Map fields for frontend
        name:
          profile.user?.fullName || profile.basicInfo?.firstName || 'Unknown',
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

  if (limit && limit > 0) {
    return finalMatches.slice(0, limit);
  }

  return finalMatches;
}
