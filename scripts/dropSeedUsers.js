/**
 * dropSeedUsers.js
 * Deletes all seeded users/profiles (identified by @example.com email)
 * Run: node scripts/dropSeedUsers.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import '../src/models/User.js';
import '../src/models/Profile.js';

const User = mongoose.model('User');
const Profile = mongoose.model('Profile');

async function main() {
  console.log('🔌  Connecting…');
  await mongoose.connect(process.env.MONGO_URI);

  const seedUsers = await User.find({email: /@example\.com$/}, '_id');
  const seedIds = seedUsers.map(u => u._id);
  console.log(`Found ${seedIds.length} seed users`);

  const delUsers = await User.deleteMany({email: /@example\.com$/});
  const delProfiles = await Profile.deleteMany({userId: {$in: seedIds}});

  console.log(
    `✅  Deleted ${delUsers.deletedCount} users and ${delProfiles.deletedCount} profiles`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
