import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Like from './src/models/Like.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find all likes grouped by sender and receiver
    const duplicates = await Like.aggregate([
      {
        $group: {
          _id: { senderId: "$senderId", receiverId: "$receiverId" },
          count: { $sum: 1 },
          likes: { $push: { _id: "$_id", type: "$likedContent.type", url: "$likedContent.photoUrl", createdAt: "$createdAt" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log("DUPLICATE LIKES FOUND:");
    console.log(JSON.stringify(duplicates, null, 2));
    
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

checkDuplicates();
