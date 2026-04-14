/**
 * profileValidators.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE unified Zod schema for all profile writes.
 * Used by both the onboarding flow and profile editing via PATCH /profile.
 * All fields are optional to support partial updates and skipped steps.
 */
import {z} from 'zod';

// ── Sub-schemas (reusable, all fields optional) ────────────────────────────

const basicInfoSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  dob: z.string().optional(),
  email: z.string().email().optional(),
  notificationsEnabled: z.boolean().optional(),
  location: z.string().optional(),
  locationDetails: z
    .object({
      lat: z.number(),
      lng: z.number(),
      source: z.string().optional(),
      timestamp: z.number().optional(),
      city: z.string().optional(),
    })
    .optional(),
  gender: z.enum(['Man', 'Woman', 'Non Binary']).optional(),
  showGenderOnProfile: z.boolean().optional(),
}).optional();

const datingPreferencesSchema = z.object({
  whoToDate: z
    .array(z.enum(['Men', 'Women', 'Nonbinary People', 'Everyone']))
    .optional(),
  datingIntention: z.string().optional(),
  relationshipType: z.enum(['Monogamy', 'Non-Monogamy']).optional(),
  showIntentionOnProfile: z.boolean().optional(),
  showRelationshipTypeOnProfile: z.boolean().optional(),
}).optional();

const personalDetailsSchema = z.object({
  familyPlans: z.string().optional(),
  hasChildren: z.string().optional(),
  ethnicity: z.string().optional(),
  height: z.string().optional(),
  hometown: z.string().optional(),
  workplace: z.string().optional(),
  jobTitle: z.string().optional(),
  school: z.string().optional(),
  educationLevel: z.string().optional(),
}).optional();

const lifestyleSchema = z.object({
  drink: z.string().optional(),
  smokeTobacco: z.string().optional(),
  smokeWeed: z.string().optional(),
  drugs: z.string().optional(),
  politicalBeliefs: z.string().optional(),
  religiousBeliefs: z.string().optional(),
  interests: z.array(z.string()).optional(),
  pets: z.array(z.string()).optional(),
}).optional();

const profilePromptsSchema = z.object({
  aboutMe: z
    .object({question: z.string().optional(), answer: z.string().optional()})
    .optional(),
  selfCare: z
    .object({question: z.string().optional(), answer: z.string().optional()})
    .optional(),
  gettingPersonal: z
    .object({question: z.string().optional(), answer: z.string().optional()})
    .optional(),
}).optional();

const mediaSchema = z.object({
  media: z
    .array(
      z.object({
        type: z.enum(['photo', 'video', 'image']),
        url: z.string(),
        order: z.number(),
      }),
    )
    .optional(),
}).optional();

// ── SINGLE unified patchProfileSchema ─────────────────────────────────────
// This is the ONLY schema used across the entire application.
// Onboarding screens send sub-objects (e.g., { basicInfo: { ... } }).
// ProfileDetailsScreen sends the same structure, potentially multi-section.
export const patchProfileSchema = z.object({
  basicInfo: basicInfoSchema,
  datingPreferences: datingPreferencesSchema,
  personalDetails: personalDetailsSchema,
  lifestyle: lifestyleSchema,
  profilePrompts: profilePromptsSchema,
  media: mediaSchema,
  isPaused: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

// ── Legacy exports kept as aliases to avoid breaking any utility imports ───
// These are NOT used as separate endpoints anymore. Only patchProfileSchema is used.
export const updateProfileSchema = patchProfileSchema;
