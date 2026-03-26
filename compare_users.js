import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config();

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in .env');
    }
    
    console.log(`Connecting to database...`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

    // Import models
    const User = (await import('./src/models/User.js')).default;
    const Profile = (await import('./src/models/Profile.js')).default;

    const users = await User.find({}).lean();
    const profiles = await Profile.find({}).lean();

    console.log(`Found ${users.length} users and ${profiles.length} profiles.`);

    let matchingNames = 0;
    let mismatchedNames = 0;
    let missingNames = 0;

    for (const user of users) {
      const p = profiles.find(pr => pr.userId === (user._id?.toString() || user.id));
      
      const fullName = (user.fullName || '').trim();
      const firstName = (p?.basicInfo?.firstName || '').trim();
      const lastName = (p?.basicInfo?.lastName || '').trim();
      const combinedProfileName = `${firstName} ${lastName}`.trim();

      if (!fullName && !firstName) {
        missingNames++;
        continue;
      }

      // Check if user.fullName matches combined profile name OR just firstName
      const matches = 
        fullName.toLowerCase() === combinedProfileName.toLowerCase() || 
        fullName.toLowerCase() === firstName.toLowerCase();

      if (matches) {
        matchingNames++;
      } else {
        mismatchedNames++;
        console.log(`Mismatched User ID: ${user._id}`);
        console.log(`  User.fullName: "${fullName}"`);
        console.log(`  Profile.basicInfo: "${firstName} ${lastName}"`);
      }
    }

    console.log('\n--- STATISTICS ---');
    console.log(`Total Users: ${users.length}`);
    console.log(`Matching Names: ${matchingNames}`);
    console.log(`Mismatched Names: ${mismatchedNames}`);
    console.log(`Missing Names: ${missingNames}`);

    process.exit(0);
  } catch (err) {
    console.error('Error running script:', err.message);
    process.exit(1);
  }
}

run();
