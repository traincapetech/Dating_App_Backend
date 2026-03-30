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
const HINGLISH_ABUSE = [
  // Existing ones (kept as is)
  'bhenchod', 'behenchod', 'madarchod', 'madharchod', 'chutiya','randi','gandu','kamina','harami','bhadva','saala', 
  'lodu', 'loda', 'lode', 'bhosdike', 'bsdk', 'bhosdk', 'bosdk', 'saali','bkl','behen ke land',
  'maa ke laude','chhinar','choot','chut','chooche','bhund','gendu','maa ki aankh','lodi','laudi','raand', 
  'gandwi','jhantu','jhant','bawri gend','baap ka lund','dadichod','nanichod','aand bhat','aand','tatte',

  // More Hindi / Hinglish (very common)
  'bc', 'mc', 'chutiyapa', 'chutiyapanti', 'bakchod', 'bakchodi', 'bhosdiwala', 'bhosdiwale', 
  'maa ki chut', 'terimaa', 'teri maa', 'teri behen', 'behen ke chode', 'maa ke bhosde', 
  'lund', 'launda', 'lavda', 'lavde', 'lavdu', 'chod', 'chud', 'chudwa', 'chudwane', 
  'gand', 'gaand', 'gaandu', 'gaandfat', 'pel', 'pelu', 'pelunga', 'thok', 'thokunga', 
  'haramkhor', 'haramzada', 'kutti', 'kuttiya', 'suvar', 'suar', 'suar ke bachche',

  // Marathi (very common in Maharashtra)
  'bhosdya', 'bhosadya', 'gandya', 'gandyaala', 'lavdya', 'lavdyacha', 'chutya', 
  , 'aai chi gand', 'aai chi chut', 'zhavyacha', 
  'pudya', 'pudyacha', 'baylya', 'bayle', 'maderchod', 'bhenchodya', 'randichya',

  // Bengali (common in West Bengal & Bangladesh)
  'bhodro', 'bhodrolok', 'khankir chele', 'khanki', 'khankir pola', 'magi', 'magir pola', 
  'chodna', 'chod', 'beshya', 'beshya putro', 'tor maa re', 'tor bon re', 'salaa', 
  'bal', 'bal chera', 'baler', 'fuchka', 'fuchki', 'dhon', 'dhoner', 'gud', 'guder',

  // Bihari / Nihari / Eastern UP-Bihar style (very raw & common)
  'bhen ke launda',  'betichod', 'beti chod', 
  'sasura', 'sasur', 'sasur ke', 'lounda', 'loundiya', 
  'goar', 'goar ke', 'thokwa', 'pelwa', 'maarwa', 'chhinarwa', 'randiwa',

  // South Indian style (Tamil/Telugu/Kannada/Malayalam mix - phonetic)
  'punda', 'pundamavale', 'thayoli', 'thayoliya', 'ooli', 'oolimavan', 'panni', 'panni da', 
  'mayir', 'mayiru', 'thenga', 'thengachi', 'naaye', 'naayee', 'kutta', 'kuttiya', 
  'kandapayale', 'loosu', 'loosu payale', 'dengu', 'dengra', 'dengina', 'gudda', 'guddu',

  // Mixed / Pan-India viral ones
  'fuckiya', 'fuck chod', 'asshole', 'bastard', 'sala', 'sali', 'chamanchutiya', 
];

const BODY_SHAMING = [
  'moti','mota','fat','ugly','badsoorat','kaali','kaala','skinny','hathi','bhains','chakka','hijra','kinnar'
];


filter.addWords(...HINGLISH_ABUSE, ...BODY_SHAMING);

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