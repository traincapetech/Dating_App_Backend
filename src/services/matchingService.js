import {getProfile} from './profileService.js';
import {hasActiveBoost} from './boostService.js';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first location
 * @param {number} lon1 - Longitude of first location
 * @param {number} lat2 - Latitude of second location
 * @param {number} lon2 - Longitude of second location
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return null; // Return null if location data is missing
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract coordinates from location string or object
 * @param {string|object} location - Location string or object with lat/lng
 * @returns {object|null} Object with lat and lng, or null
 */
function extractCoordinates(location) {
  if (!location) return null;
  
  // If it's an object with lat/lng
  if (typeof location === 'object') {
    if (location.lat && location.lng) {
      return {lat: location.lat, lng: location.lng};
    }
    if (location.latitude && location.longitude) {
      return {lat: location.latitude, lng: location.longitude};
    }
  }
  
  // If it's a string, try to parse (Google Places format)
  // This is a simplified version - you may need to enhance based on your location format
  return null;
}

/**
 * Check if genders match preferences
 * @param {string} userGender - Current user's gender
 * @param {array} userWhoToDate - Current user's whoToDate preferences
 * @param {string} profileGender - Profile's gender
 * @param {array} profileWhoToDate - Profile's whoToDate preferences
 * @returns {boolean} True if genders match preferences
 */
function checkGenderCompatibility(userGender, userWhoToDate, profileGender, profileWhoToDate) {
  // If user wants "Everyone", they match with anyone
  if (userWhoToDate?.includes('Everyone')) {
    // But check if the profile also wants the user's gender
    if (profileWhoToDate?.includes('Everyone')) {
      return true;
    }
    // Map user gender to profile's preferences
    const genderMap = {
      'Man': 'Men',
      'Woman': 'Women',
      'Non Binary': 'Nonbinary People',
    };
    return profileWhoToDate?.includes(genderMap[userGender]) || false;
  }

  // Map genders to preference format
  const genderMap = {
    'Man': 'Men',
    'Woman': 'Women',
    'Non Binary': 'Nonbinary People',
  };

  const userPrefers = genderMap[profileGender];
  const profilePrefers = genderMap[userGender];

  // Check if user wants this profile's gender
  const userWantsProfile = userWhoToDate?.includes(userPrefers) || userWhoToDate?.includes('Everyone');
  
  // Check if profile wants user's gender
  const profileWantsUser = profileWhoToDate?.includes(profilePrefers) || profileWhoToDate?.includes('Everyone');

  return userWantsProfile && profileWantsUser;
}

/**
 * Calculate compatibility score between two profiles
 * @param {object} currentUserProfile - Current user's profile
 * @param {object} otherProfile - Other user's profile
 * @returns {object} Match result with score and details
 */
export function calculateCompatibilityScore(currentUserProfile, otherProfile) {
  let score = 0;
  let maxScore = 0;
  const details = {
    genderMatch: false,
    intentionMatch: false,
    relationshipTypeMatch: false,
    lifestyleMatch: 0,
    familyPlansMatch: false,
    distance: null,
    distanceScore: 0,
  };

  const currentUser = currentUserProfile;
  const other = otherProfile;

  // 1. Gender/WhoToDate compatibility (Required - 30 points)
  maxScore += 30;
  const genderMatch = checkGenderCompatibility(
    currentUser.basicInfo?.gender,
    currentUser.datingPreferences?.whoToDate,
    other.basicInfo?.gender,
    other.datingPreferences?.whoToDate,
  );
  details.genderMatch = genderMatch;
  if (genderMatch) {
    score += 30;
  } else {
    // If genders don't match, return early with 0 score
    return {
      score: 0,
      maxScore: 100,
      percentage: 0,
      details,
      passed: false,
    };
  }

  // 2. Dating intention compatibility (20 points)
  maxScore += 20;
  const userIntention = currentUser.datingPreferences?.datingIntention;
  const otherIntention = other.datingPreferences?.datingIntention;
  if (userIntention && otherIntention) {
    // Exact match
    if (userIntention === otherIntention) {
      score += 20;
      details.intentionMatch = true;
    } 
    // Compatible intentions (both want long-term, or both want short-term)
    else if (
      (userIntention.includes('Long-term') && otherIntention.includes('Long-term')) ||
      (userIntention.includes('Short-term') && otherIntention.includes('Short-term'))
    ) {
      score += 15;
      details.intentionMatch = true;
    }
    // Partial compatibility
    else if (
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
  const lifestyleFields = ['drink', 'smokeTobacco', 'smokeWeed', 'useDrugs', 'politicalBeliefs', 'religiousBeliefs'];
  let lifestyleFieldsCount = 0;
  
  lifestyleFields.forEach(field => {
    const userValue = currentUser.lifestyle?.[field];
    const otherValue = other.lifestyle?.[field];
    
    if (userValue && otherValue && userValue !== 'Prefer not to say' && otherValue !== 'Prefer not to say') {
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
    // Exact match
    if (userFamilyPlans === otherFamilyPlans) {
      score += 15;
      details.familyPlansMatch = true;
    }
    // Compatible (both want children or both don't want)
    else if (
      (userFamilyPlans === "Want children" && otherFamilyPlans === "Want children") ||
      (userFamilyPlans === "Don't want children" && otherFamilyPlans === "Don't want children")
    ) {
      score += 15;
      details.familyPlansMatch = true;
    }
    // One is "Not sure yet" - partial compatibility
    else if (
      userFamilyPlans === 'Not sure yet' || 
      otherFamilyPlans === 'Not sure yet'
    ) {
      score += 8;
    }
  }

  // 6. Distance score (bonus points, up to 10 points)
  maxScore += 10;
  const userLocation = currentUser.basicInfo?.locationDetails || currentUser.basicInfo?.location;
  const otherLocation = other.basicInfo?.locationDetails || other.basicInfo?.location;
  
  const userCoords = extractCoordinates(userLocation);
  const otherCoords = extractCoordinates(otherLocation);
  
  if (userCoords && otherCoords) {
    const distance = calculateDistance(
      userCoords.lat,
      userCoords.lng,
      otherCoords.lat,
      otherCoords.lng,
    );
    details.distance = distance;
    
    if (distance !== null) {
      // Closer = higher score (max 10 points for < 5km, decreasing to 0 at 50km+)
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
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    score,
    maxScore,
    percentage,
    details,
    passed: details.genderMatch, // Must pass gender check
  };
}

/**
 * Get matched profiles for a user with compatibility scores
 * @param {string} userId - Current user's ID
 * @param {object} options - Matching options
 * @param {number} options.minScore - Minimum compatibility score (0-100)
 * @param {number} options.maxDistance - Maximum distance in km (null for no limit)
 * @param {string} options.sortBy - Sort by: 'score', 'distance', 'recent'
 * @param {number} options.limit - Maximum number of profiles to return
 * @returns {Promise<array>} Array of matched profiles with scores
 */
export async function getMatchedProfiles(userId, options = {}) {
  const {
    minScore = 0,
    maxDistance = null,
    sortBy = 'score',
    limit = null,
  } = options;

  // Get current user's profile
  const currentUserProfile = await getProfile(userId);
  if (!currentUserProfile) {
    return [];
  }

  // Get all other profiles (without matching to avoid circular dependency)
  const {getProfiles} = await import('../models/profileModel.js');
  const {getUsers} = await import('../models/userModel.js');
  
  const profiles = await getProfiles();
  const users = await getUsers();
  
  // Enrich profiles with user data
  const allProfiles = profiles
    .filter(profile => profile.userId !== userId)
    .map(profile => {
      const user = users.find(u => u.id === profile.userId);
      return {
        ...profile,
        name: user?.fullName || 
          (profile.basicInfo?.firstName && profile.basicInfo?.lastName 
            ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim()
            : profile.basicInfo?.firstName || profile.basicInfo?.lastName || 'Unknown'),
        email: user?.email || '',
        age: profile.personalDetails?.age || profile.basicInfo?.age || null,
        photos: profile.media?.media?.map(m => m.url).filter(Boolean) || [],
        bio: profile.profilePrompts?.bio || profile.basicInfo?.bio || '',
        interests: profile.lifestyle?.interests || [],
        distance: null,
      };
    })
    .filter(profile => profile.photos.length > 0);

  // Check which profiles have active boosts (batch check for efficiency)
  const boostChecks = await Promise.all(
    allProfiles.map(profile => hasActiveBoost(profile.userId))
  );

  // Calculate compatibility scores
  const matchedProfiles = allProfiles
    .map((profile, index) => {
      const matchResult = calculateCompatibilityScore(currentUserProfile, profile);
      const isBoosted = boostChecks[index];
      return {
        ...profile,
        matchScore: matchResult.score,
        matchPercentage: matchResult.percentage,
        matchDetails: matchResult.details,
        isBoosted, // Add boost status
      };
    })
    .filter(profile => {
      // Filter by minimum score
      if (profile.matchPercentage < minScore) {
        return false;
      }

      // Filter by maximum distance
      if (maxDistance !== null && profile.matchDetails.distance !== null) {
        if (profile.matchDetails.distance > maxDistance) {
          return false;
        }
      }

      // Must pass gender compatibility
      return profile.matchDetails.passed;
    })
    .sort((a, b) => {
      // Prioritize boosted profiles first
      if (a.isBoosted && !b.isBoosted) return -1;
      if (!a.isBoosted && b.isBoosted) return 1;

      // Then sort by specified criteria
      switch (sortBy) {
        case 'score':
          return b.matchPercentage - a.matchPercentage;
        case 'distance':
          if (a.matchDetails.distance === null) return 1;
          if (b.matchDetails.distance === null) return -1;
          return a.matchDetails.distance - b.matchDetails.distance;
        case 'recent':
          // Sort by updatedAt or createdAt
          const aDate = new Date(a.updatedAt || a.createdAt || 0);
          const bDate = new Date(b.updatedAt || b.createdAt || 0);
          return bDate - aDate;
        default:
          return b.matchPercentage - a.matchPercentage;
      }
    });

  // Apply limit
  if (limit && limit > 0) {
    return matchedProfiles.slice(0, limit);
  }

  return matchedProfiles;
}

