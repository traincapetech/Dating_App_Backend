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

    const profileCount = await Profile.countDocuments();
    console.log('Total Profiles:', profileCount);

    const targetId = 'ca0a4734-5ea0-4e50-9882-9108a5a34d15';
    const userLikes = await Like.countDocuments({senderId: targetId});
    const userPasses = await Pass.countDocuments({userId: targetId});
    console.log(
      `User ${targetId} Swipes: ${userLikes} Likes, ${userPasses} Passes`,
    );

    const hasPhotos = await Profile.countDocuments({
      'media.media.0': {$exists: true},
    });
    const hasPhotosLegacy = await Profile.countDocuments({
      'photos.0': {$exists: true},
    });
    console.log(
      `Profiles with photos: ${hasPhotos} (new) / ${hasPhotosLegacy} (legacy)`,
    );

    const sample = await Profile.findOne();
    console.log('FULL PROFILE SAMPLE:', JSON.stringify(sample, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDB();
