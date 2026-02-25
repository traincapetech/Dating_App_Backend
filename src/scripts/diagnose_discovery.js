import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env');
dotenv.config({path: envPath});

const ProfileSchema = new mongoose.Schema({}, {strict: false});
const Profile = mongoose.model('Profile', ProfileSchema);

const LikeSchema = new mongoose.Schema({}, {strict: false});
const Like = mongoose.model('Like', LikeSchema);

const PassSchema = new mongoose.Schema({}, {strict: false});
const Pass = mongoose.model('Pass', PassSchema);

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const targetId = 'ca0a4734-5ea0-4e50-9882-9108a5a34d15';

    // 1. Check User's Swipe History
    const likesCount = await Like.countDocuments({senderId: targetId});
    const passesCount = await Pass.countDocuments({userId: targetId});
    const likes = await Like.find({senderId: targetId}, 'receiverId');
    const passes = await Pass.find({userId: targetId}, 'passedUserId');

    const swipedIds = new Set([
      ...likes.map(l => l.receiverId),
      ...passes.map(p => p.passedUserId),
    ]);

    console.log(`\n--- USER STATS (${targetId}) ---`);
    console.log(`Likes sent: ${likesCount}`);
    console.log(`Passes sent: ${passesCount}`);
    console.log(`Total unique profiles swiped: ${swipedIds.size}`);

    // 2. Check Available Profiles
    const allProfiles = await Profile.find();
    console.log(`\n--- GLOBAL STATS ---`);
    console.log(`Total Profiles in DB: ${allProfiles.length}`);

    // 3. Simulation of Filtering Logic
    console.log(`\n--- FILTERING SIMULATION for User ${targetId} ---`);

    const viewerProfile = allProfiles.find(p => p.userId === targetId);
    if (!viewerProfile) {
      console.log('CRITICAL: Viewer profile NOT FOUND in database!');
    } else {
      console.log(`Viewer Gender: ${viewerProfile.basicInfo?.gender}`);
      console.log(
        `Viewer Interests: ${viewerProfile.lifestyle?.interests?.join(', ')}`,
      );
      console.log(
        `Viewer WhoToDate: ${viewerProfile.datingPreferences?.whoToDate?.join(
          ', ',
        )}`,
      );
    }

    let excludedSelf = 0;
    let alreadySwiped = 0;
    let noPhotos = 0;
    let genderFiltered = 0;
    let pauseHidden = 0;
    let available = 0;

    allProfiles.forEach(p => {
      if (p.userId === targetId) {
        excludedSelf++;
        return;
      }
      if (swipedIds.has(p.userId)) {
        alreadySwiped++;
        return;
      }
      if (p.isPaused || p.isHidden) {
        pauseHidden++;
        return;
      }

      const photos =
        p.media?.media?.map(m => m.url).filter(Boolean) || p.photos || [];
      if (photos.length === 0) {
        noPhotos++;
        return;
      }

      available++;
    });

    console.log(`Excluding Self: ${excludedSelf}`);
    console.log(`Excluding Already Swiped: ${alreadySwiped}`);
    console.log(`Excluding Paused/Hidden: ${pauseHidden}`);
    console.log(`Excluding No Photos: ${noPhotos}`);
    console.log(`\nRESULTING AVAILABLE PROFILES: ${available}`);

    // 4. Check Matches
    const matchesCount = await mongoose
      .model('Match', new mongoose.Schema({}, {strict: false}))
      .countDocuments({users: targetId, chatEnabled: true});
    console.log(`\n--- MATCHES ---`);
    console.log(`Active matches for user: ${matchesCount}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDB();
