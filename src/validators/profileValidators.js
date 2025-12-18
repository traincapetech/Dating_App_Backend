import {z} from 'zod';

export const basicInfoSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  dob: z.string().optional(), // ISO date string YYYY-MM-DD
  email: z.string().email().optional(),
  notificationsEnabled: z.boolean().optional(),
  location: z.string().optional(),
  gender: z.enum(['Man', 'Woman', 'Non Binary']).optional(),
  showGenderOnProfile: z.boolean().optional(),
});

export const datingPreferencesSchema = z.object({
  whoToDate: z.array(z.enum(['Men', 'Women', 'Nonbinary People', 'Everyone'])).optional(),
  datingIntention: z.string().optional(),
  relationshipType: z.enum(['Monogamy', 'Non-Monogamy']).optional(),
  showIntentionOnProfile: z.boolean().optional(),
  showRelationshipTypeOnProfile: z.boolean().optional(),
});

export const personalDetailsSchema = z.object({
  familyPlans: z.string().optional(),
  hasChildren: z.string().optional(),
  ethnicity: z.string().optional(),
  height: z.string().optional(),
  hometown: z.string().optional(),
  workplace: z.string().optional(),
  jobTitle: z.string().optional(),
  school: z.string().optional(),
  educationLevel: z.string().optional(),
});

export const lifestyleSchema = z.object({
  drink: z.string().optional(),
  smokeTobacco: z.string().optional(),
  smokeWeed: z.string().optional(),
  useDrugs: z.string().optional(),
  politicalBeliefs: z.string().optional(),
  religiousBeliefs: z.string().optional(),
  interests: z.array(z.string()).optional(),
});

export const profilePromptsSchema = z.object({
  aboutMe: z.object({
    prompt: z.string().optional(),
    answer: z.string().optional(),
  }).optional(),
  selfCare: z.object({
    prompt: z.string().optional(),
    answer: z.string().optional(),
  }).optional(),
  gettingPersonal: z.object({
    prompt: z.string().optional(),
    answer: z.string().optional(),
  }).optional(),
});

export const mediaUploadSchema = z.object({
  media: z.array(z.object({
    type: z.enum(['photo', 'video']),
    url: z.string(),
    order: z.number(),
  })).optional(),
});

export const updateProfileSchema = z.object({
  basicInfo: basicInfoSchema.optional(),
  datingPreferences: datingPreferencesSchema.optional(),
  personalDetails: personalDetailsSchema.optional(),
  lifestyle: lifestyleSchema.optional(),
  profilePrompts: profilePromptsSchema.optional(),
  media: mediaUploadSchema.optional(),
});

