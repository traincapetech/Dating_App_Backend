/**
 * Moderation Service
 * Handles content moderation, abuse detection, and safety features
 */

// Basic profanity filter keywords (expandable)
const PROFANITY_KEYWORDS = [
  // Add your list of inappropriate words here
  // This is a basic implementation - consider using a library like 'bad-words' for production
];

// Suspicious patterns for fake profile detection
const SUSPICIOUS_PATTERNS = {
  // Too many similar photos
  duplicatePhotos: (photos) => {
    if (!photos || photos.length < 2) return false;
    // Check if photos are too similar (basic check)
    return false; // Implement image similarity check if needed
  },

  // Suspicious bio patterns
  suspiciousBio: (bio) => {
    if (!bio) return false;
    const lowerBio = bio.toLowerCase();

    // Check for common fake profile indicators
    const indicators = [
      'add me on snap',
      'add me on instagram',
      'follow me on',
      'click here',
      'free money',
      'bitcoin',
      'crypto',
      'investment',
    ];

    return indicators.some(indicator => lowerBio.includes(indicator));
  },

  // Too few photos
  insufficientPhotos: (photos) => {
    return !photos || photos.length < 2;
  },

  // Suspicious age
  suspiciousAge: (age) => {
    return age < 18 || age > 100;
  },
};

/**
 * Check message for abuse/inappropriate content
 */
export function detectChatAbuse(text) {
  if (!text) return { isAbusive: false, reason: null };

  const lowerText = text.toLowerCase();

  // Check for profanity
  const hasProfanity = PROFANITY_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  if (hasProfanity) {
    return { isAbusive: true, reason: 'profanity', severity: 'medium' };
  }

  // Check for harassment patterns
  const harassmentPatterns = [
    /send.*nude/i,
    /send.*pic/i,
    /meet.*now/i,
    /come.*over/i,
  ];

  const hasHarassment = harassmentPatterns.some(pattern => pattern.test(text));
  if (hasHarassment) {
    return { isAbusive: true, reason: 'harassment', severity: 'high' };
  }

  // Check for spam patterns
  const spamPatterns = [
    /http[s]?:\/\//i, // URLs
    /www\./i,
    /bit\.ly|tinyurl|short\.link/i, // Short links
  ];

  const hasSpam = spamPatterns.some(pattern => pattern.test(text));
  if (hasSpam) {
    return { isAbusive: true, reason: 'spam', severity: 'medium' };
  }

  return { isAbusive: false, reason: null };
}

/**
 * Analyze profile for fake profile indicators
 */
export function detectFakeProfile(profile) {
  const flags = [];
  let riskScore = 0;

  // Check bio
  if (profile.basicInfo?.bio || profile.profilePrompts?.aboutMe?.answer) {
    const bio = profile.basicInfo?.bio || profile.profilePrompts?.aboutMe?.answer;
    if (SUSPICIOUS_PATTERNS.suspiciousBio(bio)) {
      flags.push('suspicious_bio');
      riskScore += 30;
    }
  }

  // Check photos
  const photos = profile.media?.media || [];
  if (SUSPICIOUS_PATTERNS.insufficientPhotos(photos)) {
    flags.push('insufficient_photos');
    riskScore += 20;
  }

  // Check age
  if (profile.basicInfo?.dob) {
    const dob = new Date(profile.basicInfo.dob);
    const age = new Date().getFullYear() - dob.getFullYear();
    if (SUSPICIOUS_PATTERNS.suspiciousAge(age)) {
      flags.push('suspicious_age');
      riskScore += 25;
    }
  }

  // Check for empty profile
  if (!profile.basicInfo?.bio && !profile.profilePrompts?.aboutMe?.answer && photos.length === 0) {
    flags.push('empty_profile');
    riskScore += 15;
  }

  // Determine if fake
  const isFake = riskScore >= 50;

  return {
    isFake,
    riskScore,
    flags,
    recommendation: isFake ? 'flag_for_review' : riskScore >= 30 ? 'monitor' : 'approved',
  };
}

/**
 * Moderate image (basic implementation)
 * In production, integrate with AWS Rekognition, Google Cloud Vision, or similar
 */
export async function moderateImage(imageUrl) {
  // Basic implementation - in production, use ML service
  // For now, return a placeholder that can be extended

  // TODO: Integrate with image moderation service
  // Example: AWS Rekognition, Google Cloud Vision API, or Cloudinary Moderation

  return {
    isSafe: true, // Default to safe until moderation service is integrated
    confidence: 0.95,
    categories: {
      explicit: false,
      suggestive: false,
      violence: false,
      hate: false,
    },
    moderationService: 'none', // 'aws_rekognition', 'google_vision', 'cloudinary', etc.
  };
}

/**
 * Auto-review profile based on moderation checks
 */
export async function autoReviewProfile(profile) {
  const fakeProfileCheck = detectFakeProfile(profile);

  // If high risk, flag for manual review
  if (fakeProfileCheck.isFake || fakeProfileCheck.riskScore >= 50) {
    return {
      status: 'flagged',
      reason: 'auto_flagged',
      flags: fakeProfileCheck.flags,
      riskScore: fakeProfileCheck.riskScore,
      requiresManualReview: true,
    };
  }

  // If medium risk, mark as pending review
  if (fakeProfileCheck.riskScore >= 30) {
    return {
      status: 'pending',
      reason: 'auto_pending',
      flags: fakeProfileCheck.flags,
      riskScore: fakeProfileCheck.riskScore,
      requiresManualReview: true,
    };
  }

  // Low risk, auto-approve
  return {
    status: 'approved',
    reason: 'auto_approved',
    flags: [],
    riskScore: fakeProfileCheck.riskScore,
    requiresManualReview: false,
  };
}

export default {
  detectChatAbuse,
  detectFakeProfile,
  moderateImage,
  autoReviewProfile,
};

