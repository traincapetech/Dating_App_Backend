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
  'aai chi gand', 'aai chi chut', 'zhavyacha', 
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

  if (scamPatterns.some(p => p.test(text)) || CUSTOM_KEYWORDS.some(w => normalized.includes(w))) {
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

/* ---------------- IMAGE MODERATION (Azure AI Content Safety OR Sightengine) ---------------- */

/**
 * Helper to normalize Buffer / base64 / URL into a Buffer for Sightengine multipart upload.
 */
async function toImageBuffer(imageInput) {
  if (Buffer.isBuffer(imageInput)) return imageInput;
  if (typeof imageInput === 'string') {
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const res = await fetch(imageInput);
      if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    const cleaned = imageInput.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    return Buffer.from(cleaned, 'base64');
  }
  return null;
}

/**
 * Sightengine image moderation (free tier: 2,000 ops/mo, no credit card required).
 * Env vars: SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET
 */
async function moderateImageWithSightengine(imageInput, apiUser, apiSecret) {
  const threshold = Number.parseFloat(process.env.SIGHTENGINE_THRESHOLD || '0.65');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    let response;
    if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
      const params = new URLSearchParams({
        models: 'nudity-2.1,wad,offensive,gore-2.0',
        api_user: apiUser,
        api_secret: apiSecret,
        url: imageInput,
      });
      response = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal,
      });
    } else {
      const buffer = await toImageBuffer(imageInput);
      if (!buffer || buffer.length === 0) {
        return {isSafe: false, provider: 'sightengine', categories: ['invalid_image']};
      }
      const formData = new FormData();
      formData.append('models', 'nudity-2.1,wad,offensive,gore-2.0');
      formData.append('api_user', apiUser);
      formData.append('api_secret', apiSecret);
      formData.append('media', new Blob([buffer], {type: 'image/jpeg'}), 'upload.jpg');
      response = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Sightengine HTTP ${response.status}: ${errText.slice(0, 120)}`);
    }

    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.error?.message || 'Sightengine returned failure status');
    }

    const flagged = [];
    const nudity = data.nudity || {};
    const explicitScore = Math.max(
      Number(nudity.sexual_activity || 0),
      Number(nudity.sexual_display || 0),
      Number(nudity.erotica || 0),
      Number(nudity.very_suggestive || 0),
    );
    if (explicitScore >= threshold) flagged.push(`Sexual:${explicitScore.toFixed(2)}`);
    if (Number(data.weapon || 0) >= threshold) flagged.push(`Weapon:${Number(data.weapon).toFixed(2)}`);
    if (Number(data.gore?.prob || 0) >= threshold) flagged.push(`Gore:${Number(data.gore.prob).toFixed(2)}`);
    if (Number(data.offensive?.prob || 0) >= threshold) flagged.push(`Offensive:${Number(data.offensive.prob).toFixed(2)}`);

    return {
      isSafe: flagged.length === 0,
      provider: 'sightengine',
      categories: flagged,
      scores: {explicitScore, weapon: data.weapon, gore: data.gore?.prob, offensive: data.offensive?.prob},
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Moderates an image via Azure AI Content Safety OR Sightengine (whichever credentials are configured).
 * Accepts a Buffer, a base64 string (with or without data: prefix), or an https URL.
 * Env vars:
 *   - Azure:       AZURE_CONTENT_SAFETY_ENDPOINT, AZURE_CONTENT_SAFETY_KEY, AZURE_CONTENT_SAFETY_THRESHOLD (default 4)
 *   - Sightengine: SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET, SIGHTENGINE_THRESHOLD (default 0.65)
 */
export async function moderateImage(imageInput) {
  const endpoint = (process.env.AZURE_CONTENT_SAFETY_ENDPOINT || '').replace(/\/+$/, '');
  const apiKey = process.env.AZURE_CONTENT_SAFETY_KEY || '';
  const threshold = Number.parseInt(process.env.AZURE_CONTENT_SAFETY_THRESHOLD || '4', 10);

  const sightUser = process.env.SIGHTENGINE_API_USER || '';
  const sightSecret = process.env.SIGHTENGINE_API_SECRET || '';

  // Prefer Sightengine when Azure is not configured (no credit card needed on Sightengine free tier)
  if ((!endpoint || !apiKey) && sightUser && sightSecret) {
    try {
      return await moderateImageWithSightengine(imageInput, sightUser, sightSecret);
    } catch (error) {
      console.error('[ImageModeration] Sightengine error:', error.message);
      if (process.env.NODE_ENV === 'production') {
        return {isSafe: false, provider: 'sightengine', categories: ['moderation_error']};
      }
      return {isSafe: true, provider: 'sightengine-error-dev', categories: []};
    }
  }

  if (!endpoint || !apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[ImageModeration] Neither Azure Content Safety nor Sightengine credentials are set in production');
      return {
        isSafe: false,
        provider: 'unconfigured',
        categories: ['moderation_unavailable'],
      };
    }
    console.warn('[ImageModeration] Image moderation not configured — skipping in non-production');
    return {isSafe: true, provider: 'unconfigured-dev', categories: []};
  }

  try {
    let base64Content = null;
    if (Buffer.isBuffer(imageInput)) {
      base64Content = imageInput.toString('base64');
    } else if (typeof imageInput === 'string') {
      if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        const imgRes = await fetch(imageInput);
        if (!imgRes.ok) {
          throw new Error(`Failed to fetch image for moderation (${imgRes.status})`);
        }
        const arrBuf = await imgRes.arrayBuffer();
        base64Content = Buffer.from(arrBuf).toString('base64');
      } else {
        base64Content = imageInput.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      }
    }

    if (!base64Content) {
      return {isSafe: false, provider: 'azure-content-safety', categories: ['invalid_image']};
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(
        `${endpoint}/contentsafety/image:analyze?api-version=2024-09-01`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': apiKey,
          },
          body: JSON.stringify({
            image: {content: base64Content},
            categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
            outputType: 'FourSeverityLevels',
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Azure Content Safety HTTP ${response.status}: ${errText.slice(0, 120)}`);
    }

    const data = await response.json();
    const results = Array.isArray(data.categoriesAnalysis) ? data.categoriesAnalysis : [];
    const flagged = results
      .filter(item => Number(item.severity || 0) >= threshold)
      .map(item => `${item.category}:${item.severity}`);

    return {
      isSafe: flagged.length === 0,
      provider: 'azure-content-safety',
      categories: flagged,
      scores: results,
    };
  } catch (error) {
    console.error('[ImageModeration] Azure Content Safety error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      return {
        isSafe: false,
        provider: 'azure-content-safety',
        categories: ['moderation_error'],
      };
    }
    return {isSafe: true, provider: 'azure-error-dev', categories: []};
  }
}

export const moderateText = detectChatAbuse;

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
  moderateText,
  detectFakeProfile,
  moderateImage,
  autoReviewProfile,
};