import mongoose from 'mongoose';
import Match from './src/models/Match.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dating_app';

async function migrateMatches() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Match.updateMany(
      { lastMessageAt: { $exists: false } },
      [
        {
          $set: {
            lastMessageAt: "$createdAt"
          }
        }
      ]
    );

    console.log(`Updated ${result.modifiedCount} matches with lastMessageAt from createdAt`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateMatches();
