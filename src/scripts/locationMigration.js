import Profile from '../models/Profile.js';

/**
 * Migration script to fix existing users with invalid or missing location data.
 * Requirement: Fix [0,0] coordinates and missing GeoJSON fields by recovering from locationDetails.
 */
export async function runLocationMigration() {
  console.log('🚀 Starting Location Migration...');
  try {
    // 1. Find invalid profiles
    const invalidProfiles = await Profile.find({
      $or: [
        { location: { $exists: false } },
        { 'location.coordinates': [0, 0] },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null }
      ]
    });

    console.log(`[LocationMigration] Found ${invalidProfiles.length} profiles needing repair.`);

    let recovered = 0;
    let nullified = 0;
    let failed = 0;

    for (const profile of invalidProfiles) {
      try {
        const lat = profile.basicInfo?.locationDetails?.lat;
        const lng = profile.basicInfo?.locationDetails?.lng;

        if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
          // Recover from locationDetails
          profile.location = {
            type: 'Point',
            coordinates: [lng, lat]
          };
          await profile.save();
          recovered++;
        } else {
          // No recovery possible, explicitly set to undefined to avoid [0,0] defaults
          profile.location = undefined;
          await profile.save();
          nullified++;
        }
      } catch (err) {
        console.error(`[LocationMigration] Failed to repair profile ${profile._id}:`, err.message);
        failed++;
      }
    }

    console.log('✅ Location Migration Complete!');
    console.log(`[Summary]: 
      - Recovered: ${recovered}
      - Nullified (Unrecoverable): ${nullified}
      - Failed: ${failed}
    `);

    return { recovered, nullified, failed };
  } catch (error) {
    console.error('❌ Critical error in location migration:', error);
    throw error;
  }
}

export default runLocationMigration;
