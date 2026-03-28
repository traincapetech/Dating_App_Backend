import { Filter } from 'bad-words';

const filter = new Filter();

/* ---------------- NORMALIZATION ---------------- */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')   // remove symbols
    .replace(/\s+/g, '');
}

/* ---------------- CUSTOM WORDS ---------------- */
const CUSTOM_KEYWORDS = [
  'scam','fake','spam','onlyfans','telegram','whatsapp','cashapp','venmo','paypal',
  'sugarbaby','sugardaddy','sendmoney','moneytransfer'
];

const HINGLISH_ABUSE = [
  'bhenchod','madarchod','chutiya','randi','gandu','kamina','harami','bhadva','saala'
];

const BODY_SHAMING = [
  'moti','mota','fat','ugly','badsoorat','kaali','kaala','skinny','hathi','bhains','chakka','hijra'
];

filter.addWords(...CUSTOM_KEYWORDS, ...HINGLISH_ABUSE, ...BODY_SHAMING);

/* ---------------- CHAT MODERATION ---------------- */

export function detectChatAbuse(text) {
  if (!text) return { isAbusive: false };

  const normalized = normalize(text);

  /* 1. PROFANITY */
  const hasProfanity =
    filter.isProfane(text) ||
    HINGLISH_ABUSE.some(w => normalized.includes(w));

  if (hasProfanity) {
    return {
      isAbusive: true,
      reason: 'profanity',
      severity: 'medium',
      action: 'warn_or_block',
      message: 'Inappropriate language detected',
    };
  }

  /* 2. SEXUAL / HARASSMENT */
  const sexualPatterns = [
    /send.*nude/i,
    /nudes?/i,
    /sex/i,
    /hookup/i,
    /come.*over/i,
  ];

  if (sexualPatterns.some(p => p.test(text))) {
    return {
      isAbusive: true,
      reason: 'sexual_content',
      severity: 'high',
      action: 'block',
      message: 'Sexual or inappropriate request detected',
    };
  }

  /* 3. BODY SHAMING */
  if (BODY_SHAMING.some(w => normalized.includes(w))) {
    return {
      isAbusive: true,
      reason: 'hate_speech',
      severity: 'high',
      action: 'block',
    };
  }

  /* 4. SCAM / MONEY */
  const scamPatterns = [
    /send.*money/i,
    /pay.*me/i,
    /upi/i,
    /bank/i,
    /investment/i,
    /crypto/i,
  ];

  if (scamPatterns.some(p => p.test(text))) {
    return {
      isAbusive: true,
      reason: 'scam',
      severity: 'high',
      action: 'block',
    };
  }

  /* 5. SPAM / LINKS */
  const spamPatterns = [
    /http[s]?:\/\//i,
    /www\./i,
    /bit\.ly|tinyurl/i,
    /telegram|whatsapp|snapchat/i,
  ];

  if (spamPatterns.some(p => p.test(text))) {
    return {
      isAbusive: true,
      reason: 'spam',
      severity: 'medium',
      action: 'warn',
    };
  }

  return { isAbusive: false };
}

/* ---------------- PROFILE DETECTION ---------------- */

export function detectFakeProfile(profile) {
  let score = 0;
  const flags = [];

  const bio = profile.basicInfo?.bio || '';

  if (/instagram|snapchat|telegram/i.test(bio)) {
    flags.push('external_redirect');
    score += 30;
  }

  if (!profile.media?.media || profile.media.media.length < 2) {
    flags.push('low_photos');
    score += 20;
  }

  if (!bio) {
    flags.push('empty_bio');
    score += 10;
  }

  const isFake = score >= 50;

  return {
    isFake,
    score,
    flags,
    recommendation:
      score >= 50 ? 'flag'
      : score >= 30 ? 'review'
      : 'ok',
  };
}

/* ---------------- IMAGE MODERATION ---------------- */

export async function moderateImage(imageUrl) {
  // Placeholder (replace with real API later)
  return {
    isSafe: true,
    provider: 'mock',
  };
}

/* ---------------- AUTO REVIEW ---------------- */

export async function autoReviewProfile(profile) {
  const result = detectFakeProfile(profile);

  if (result.score >= 50) {
    return { status: 'blocked', ...result };
  }

  if (result.score >= 30) {
    return { status: 'pending', ...result };
  }

  return { status: 'approved', ...result };
}

export default {
  detectChatAbuse,
  detectFakeProfile,
  moderateImage,
  autoReviewProfile,
};