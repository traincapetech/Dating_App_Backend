/**
 * onboardingUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth logic for determining where a user is in onboarding.
 *
 * Priority:
 *   1. user.onboardingStep (stored on User model — fastest, no profile fetch needed)
 *   2. Derived from Profile fields (backward-compat for legacy users without the field)
 *
 * Step values:
 *   'BASIC_INFO' → User needs to complete basic info (name, dob, gender, location)
 *   'MEDIA'      → Basic info done, needs to upload at least 1 photo
 *   'COMPLETE'   → All core onboarding done, go to HomeTabs
 */

/**
 * Derive the onboarding step from a profile document.
 * Used as a fallback for legacy users who don't have onboardingStep on their User record.
 *
 * @param {object|null} profile - The Profile document (or null if not found)
 * @returns {'BASIC_INFO'|'MEDIA'|'COMPLETE'}
 */
export function deriveOnboardingStepFromProfile(profile) {
  if (!profile) return 'BASIC_INFO';

  const b = profile.basicInfo || {};

  // 1. BASIC_INFO → DATING_PREFERENCES
  const hasName = b.firstName || b.name;
  const hasDob = b.dob || b.birthDate;
  const hasGender = !!b.gender;
  const hasLocation =
    (b.locationDetails?.lat && b.locationDetails?.lng) ||
    b.location ||
    (profile.location?.coordinates?.[0] !== 0 &&
      profile.location?.coordinates?.[1] !== 0);

  const basicInfoComplete = hasName && hasDob && hasGender && hasLocation;
  if (!basicInfoComplete) return 'BASIC_INFO';

  // 2. DATING_PREFERENCES → PERSONAL_DETAILS
  const dp = profile.datingPreferences || {};
  const datingPrefsComplete = dp.whoToDate?.length > 0;
  if (!datingPrefsComplete) return 'DATING_PREFERENCES';

  // 3. PERSONAL_DETAILS → LIFESTYLE
  const pd = profile.personalDetails || {};
  const personalDetailsComplete = pd.height || pd.jobTitle || pd.educationLevel;
  if (!personalDetailsComplete) return 'PERSONAL_DETAILS';

  // 4. LIFESTYLE → PROFILE_PROMPTS
  const ls = profile.lifestyle || {};
  const lifestyleComplete = ls.drink || ls.smokeTobacco || ls.interests?.length > 0;
  if (!lifestyleComplete) return 'LIFESTYLE';

  // 5. PROFILE_PROMPTS → MEDIA
  const pp = profile.profilePrompts || {};
  const promptsComplete = pp.aboutMe?.answer || pp.bio || Object.keys(pp).length > 2; // heuristic
  if (!promptsComplete) return 'PROFILE_PROMPTS';

  // 6. MEDIA → COMPLETE
  const mediaCount =
    profile.media?.media?.filter(m => m?.url)?.length ||
    profile.photos?.length ||
    0;
  if (mediaCount < 1) return 'MEDIA';

  return 'COMPLETE';
}

/**
 * Get the authoritative onboarding step for a user.
 * Prefers stored value on User, falls back to profile derivation.
 *
 * @param {object} user - The User document
 * @param {object|null} profile - The Profile document (or null)
 * @returns {'BASIC_INFO'|'MEDIA'|'COMPLETE'}
 */
export function getOnboardingStep(user, profile) {
  if (user?.onboardingStep) {
    return user.onboardingStep;
  }
  // Legacy user — derive from profile
  return deriveOnboardingStepFromProfile(profile);
}
