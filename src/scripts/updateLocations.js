import mongoose from 'mongoose';
import Profile from '../models/Profile.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo';

async function updateLocations() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    const profiles = await Profile.find({});
    console.log(`Found ${profiles.length} profiles to check.`);

    let updatedCount = 0;

    for (const profile of profiles) {
      const locationStr = profile.basicInfo?.location;

      // Check if we need to update
      // If location is already set (and not 0,0 default), skip?
      // Actually, let's overwrite if we have a valid string, to be sure.

      if (
        locationStr &&
        typeof locationStr === 'string' &&
        locationStr.includes(',')
      ) {
        const parts = locationStr.split(',').map(s => s.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);

          if (!isNaN(lat) && !isNaN(lng)) {
            // MongoDB GeoJSON is [lng, lat]
            profile.location = {
              type: 'Point',
              coordinates: [lng, lat],
            };
            await profile.save();
            updatedCount++;
            // console.log(`Updated profile ${profile.id}: [${lng}, ${lat}]`);
          }
        }
      }
    }

    console.log(
      `🎉 Successfully updated locations for ${updatedCount} profiles.`,
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateLocations();
