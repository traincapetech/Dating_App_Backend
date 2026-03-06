/**
 * testDistanceFilter.js
 * Verification script to test distance filtering in the discovery service.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import '../src/models/User.js';
import '../src/models/Profile.js';
import {getAllProfiles} from '../src/services/profileService.js';

async function main() {
  console.log('🔌  Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);

  const Profile = mongoose.model('Profile');

  // 1. Pick a user from India as the viewer
  const viewerProfile = await Profile.findOne({'basicInfo.location': /India/});

  if (!viewerProfile) {
    console.error('❌  No Indian profile found. Please seed the DB first.');
    process.exit(1);
  }

  console.log('👤  Testing as viewer:', viewerProfile.basicInfo.firstName);
  console.log('📍  Location String:', viewerProfile.basicInfo.location);
  console.log(
    '📍  Root Location Field:',
    JSON.stringify(viewerProfile.location),
  );

  // Ensure viewer has location for the first tests
  if (
    !viewerProfile.location ||
    !viewerProfile.location.coordinates ||
    (viewerProfile.location.coordinates[0] === 0 &&
      viewerProfile.location.coordinates[1] === 0)
  ) {
    if (viewerProfile.basicInfo.locationDetails) {
      const {lat, lng} = viewerProfile.basicInfo.locationDetails;
      viewerProfile.location = {type: 'Point', coordinates: [lng, lat]};
      await viewerProfile.save();
      console.log('✅  Fixed viewer location coordinates.');
    } else {
      console.error('❌  Viewer has no valid coordinates for testing.');
      process.exit(1);
    }
  }

  const userId = viewerProfile.userId;
  function getCountry(profile) {
    const loc = profile.basicInfo?.location;
    if (!loc) return 'Unknown';
    const parts = loc.split(', ');
    return parts[parts.length - 1];
  }

  try {
    // 2. Test Case: 100km filter (Should ONLY see India)
    console.log('\n--- Test Case: 100km Filter ---');
    const profiles100 = await getAllProfiles(userId, {maxDistance: 100});
    const countries100 = [...new Set(profiles100.map(getCountry))];
    console.log(`Found ${profiles100.length} profiles.`);
    console.log(
      `Countries found: ${
        countries100.length > 0 ? countries100.join(', ') : 'None'
      }`,
    );

    if (countries100.length > 0 && countries100.every(c => c === 'India')) {
      console.log('✅  Success: Only Indian profiles shown.');
    } else if (countries100.length === 0) {
      console.log('⚠️  No profiles found in 100km (check jitter).');
    } else {
      console.log(
        '❌  Failure: Non-Indian profiles shown:',
        countries100.filter(c => c !== 'India'),
      );
    }

    // 3. Test Case: 5000km filter
    console.log('\n--- Test Case: 5000km Filter ---');
    const profiles5000 = await getAllProfiles(userId, {maxDistance: 5000});
    const countries5000 = [...new Set(profiles5000.map(getCountry))];
    console.log(`Found ${profiles5000.length} profiles.`);
    console.log(`Countries found: ${countries5000.join(', ')}`);

    if (countries5000.includes('Lebanon')) {
      console.log('✅  Success: Lebanon profiles included at 5000km.');
    } else {
      console.log('❌  Failure: Lebanon profiles missing at 5000km.');
    }

    // 4. Test Case: Missing Location
    console.log('\n--- Test Case: No Viewer Location ---');
    const originalCoords = [...viewerProfile.location.coordinates];
    viewerProfile.location.coordinates = [0, 0];
    await viewerProfile.save();

    try {
      const profilesNoLoc = await getAllProfiles(userId, {maxDistance: 100});
      console.log(
        `Found ${profilesNoLoc.length} profiles when viewer location is [0,0].`,
      );

      if (profilesNoLoc.length === 0) {
        console.log('✅  Success: Empty list returned as expected.');
      } else {
        console.log('❌  Failure: Profiles leaked despite missing location.');
      }
    } finally {
      // Restore viewer location
      viewerProfile.location.coordinates = originalCoords;
      await viewerProfile.save();
      console.log('🔄  Viewer location restored.');
    }
  } catch (err) {
    console.error('❌  Testing Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌  Disconnected.');
  }
}

main().catch(err => {
  console.error('❌  Fatal Error:', err);
  process.exit(1);
});
