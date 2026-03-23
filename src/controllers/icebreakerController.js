import { getProfile } from '../services/profileService.js';
import IcebreakerInteraction from '../models/IcebreakerInteraction.js';
import { ICEBREAKER_TEMPLATES, CATEGORY_KEYWORDS } from '../data/icebreakerTemplates.js';

// ─── Constants ─────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SUGGESTIONS = 3;

// ─── Helper: Keyword-Based Category Extraction ──────────────────────────────
function detectCategories(profile) {
  const bio = (profile?.bio || '').toLowerCase();
  const interests = (profile?.interests || []).join(' ').toLowerCase();
  const combinedText = `${bio} ${interests}`;
  const matchedCategories = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => combinedText.includes(kw.toLowerCase()))) {
      matchedCategories.push(category);
    }
  }

  // If no match, return travel as a safe default or default category
  return matchedCategories.length > 0 ? matchedCategories : ['default'];
}

// ─── Helper: Suggestion Selection Logic ─────────────────────────────────────
function generateSuggestions(profile, tone) {
  const name = profile?.basicInfo?.firstName || 'there';
  const categories = detectCategories(profile);
  const pool = [];

  // 1. Gather all applicable templates for these categories
  categories.forEach(cat => {
    const templates = ICEBREAKER_TEMPLATES[cat]?.[tone] || [];
    pool.push(...templates);
  });

  // 2. Add defaults to ensure enough variety
  const defaults = ICEBREAKER_TEMPLATES.default[tone];
  pool.push(...defaults);

  // 3. Shake/Shuffle the pool to avoid repetition
  const shuffled = pool.sort(() => Math.random() - 0.5);

  // 4. Extract unique ones and replace placeholders
  const uniqueItems = Array.from(new Set(shuffled));
  return uniqueItems
    .slice(0, MAX_SUGGESTIONS)
    .map(msg => msg.replace(/{name}/g, name));
}

// ─── Controller ───────────────────────────────────────────────────────────────
export const getIcebreakerSuggestions = async (req, res) => {
  const currentUserId = req.user?.id;
  const { targetUserId, matchId, tone = 'flirty' } = req.query;

  if (!targetUserId || !matchId) {
    return res.status(400).json({ error: 'targetUserId and matchId are required' });
  }

  const normalizedTone = tone === 'funny' ? 'funny' : 'flirty';

  try {
    // 1. Fetch profile to base rules on
    const profile = await getProfile(targetUserId);
    
    // 2. Instant generation (Rule-based)
    const suggestions = generateSuggestions(profile, normalizedTone);

    // 3. Analytics (Maintain tracking)
    const interaction = await IcebreakerInteraction.create({
      senderId: currentUserId,
      receiverId: targetUserId,
      matchId,
      suggestions,
      tone: normalizedTone
    });

    // 4. Immediate response (<10ms)
    return res.json({ 
      suggestions, 
      interactionId: interaction._id,
      fromCache: false // Technically no longer using cache, but matches previous contract
    });

  } catch (err) {
    console.error('[Icebreaker Error]:', err?.message);
    const fallbacks = ICEBREAKER_TEMPLATES.default[normalizedTone]
      .map(m => m.replace(/{name}/g, 'there'));
    return res.json({ suggestions: fallbacks });
  }
};

// ─── Analytics Track Action ──────────────────────────────────────────────────
export const trackIcebreakerAction = async (req, res) => {
  try {
    const { interactionId, action, value } = req.body;
    if (action === 'click') {
      await IcebreakerInteraction.findByIdAndUpdate(interactionId, {
        clickedAt: new Date(),
        clickedValue: value
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


