import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env');
dotenv.config({path: envPath});

const LikeSchema = new mongoose.Schema({}, {strict: false});
const Like = mongoose.model('Like', LikeSchema);

const PassSchema = new mongoose.Schema({}, {strict: false});
const Pass = mongoose.model('Pass', PassSchema);

async function resetSwipes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const targetId = 'ca0a4734-5ea0-4e50-9882-9108a5a34d15';

    const likesDeleted = await Like.deleteMany({senderId: targetId});
    const passesDeleted = await Pass.deleteMany({userId: targetId});

    console.log(`Reset complete for user ${targetId}:`);
    console.log(`- Deleted ${likesDeleted.deletedCount} Likes`);
    console.log(`- Deleted ${passesDeleted.deletedCount} Passes`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

resetSwipes();
