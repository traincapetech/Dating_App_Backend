import Profile from './Profile.js';

// Adapter functions to map old file-system API to new Mongoose API

export async function getProfiles() {
  const profiles = await Profile.find({});
  return profiles.map(p => p.toJSON());
}

export async function findProfileByUserId(userId) {
  const profile = await Profile.findOne({userId});
  return profile ? profile.toJSON() : undefined;
}

export async function createProfile(profileData) {
  // Ensure we set _id if provided
  const data = {...profileData};

  // If ID is not provided, generate one (Backwards compat: old model generated ID)
  // But Mongoose can generate ObjectId if we used it. Since we use String _id, we must ensure it exists.
  if (!data.id && !data._id) {
    data._id = `profile_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  } else if (data.id && !data._id) {
    data._id = data.id;
  }

  const newProfile = new Profile(data);

  // Auto-review logic (Ported from old model)
  try {
    const {autoReviewProfile} = await import(
      '../services/moderationService.js'
    );
    const reviewResult = await autoReviewProfile(newProfile.toJSON());

    newProfile.moderationStatus = reviewResult.status;
    newProfile.moderationFlags = reviewResult.flags;
    newProfile.moderationRiskScore = reviewResult.riskScore;
    newProfile.autoReviewedAt = new Date();
  } catch (error) {
    console.error('Error in auto-review:', error);
  }

  await newProfile.save();
  return newProfile.toJSON();
}

export async function updateProfile(userId, updates) {
  const safeUpdates = {...updates};
  delete safeUpdates.id;
  delete safeUpdates._id;
  delete safeUpdates.userId; // Should not change userId

  // We need to fetch first to check for significant changes for moderation
  // But findOneAndUpdate is faster. Let's do findOneAndUpdate for atomic update first.
  // Actually, we need to merge deeper fields if they are partial updates?
  // transformation in profileService.js already does deep merge and passes full object usually.
  // But wait, profileService.updateProfileData does the deep merge logic BEFORE calling this.
  // So `updates` here is the *result* of the merge (mostly).
  // Let's look at `profileService.js`:
  // `updateProfileData` merges then calls `upsertProfile` -> `updateProfile`
  // `userId` is passed. `updates` contains the merged data.
  // So we can directly set the fields.

  const updatedProfile = await Profile.findOneAndUpdate(
    {userId},
    {$set: safeUpdates},
    {new: true, runValidators: true},
  );

  if (!updatedProfile) return null;

  // Re-review logic
  // Check if significant fields changed. Since `updates` is the full object from profileService (mostly),
  // we might re-review unnecessarily if we don't diff.
  // But `profileService` passes `profileData` which is the merged object.
  // The old logic in `profileModel.js` checked: `if (updates.media || updates.basicInfo?.bio ...)`
  // In `profileService`, `updateProfileData` calls `upsertProfile` with the merged data.
  // So `updates` here IS the full new state.
  // We should probably run moderation if specific fields are *present* in the update,
  // OR just always run it on update for now to be safe/consistent with old behavior logic which was slightly different.
  // Old behavior: `const hasSignificantChanges = updates.media || ...`
  // Since `profileService` passes the full object, `updates.media` will be present.
  // So we will re-review. This is acceptable for now.

  try {
    const {autoReviewProfile} = await import(
      '../services/moderationService.js'
    );
    // We pass the updated profile document
    const reviewResult = await autoReviewProfile(updatedProfile.toJSON());

    updatedProfile.moderationStatus = reviewResult.status;
    updatedProfile.moderationFlags = reviewResult.flags;
    updatedProfile.moderationRiskScore = reviewResult.riskScore;
    updatedProfile.autoReviewedAt = new Date();

    await updatedProfile.save();
  } catch (error) {
    console.error('Error in auto-review on update:', error);
  }

  return updatedProfile.toJSON();
}

export async function upsertProfile(userId, profileData) {
  const existing = await Profile.findOne({userId});
  if (existing) {
    return updateProfile(userId, profileData);
  }
  return createProfile({...profileData, userId});
}

export async function deleteProfile(userId) {
  const result = await Profile.findOneAndDelete({userId});
  return !!result;
}
