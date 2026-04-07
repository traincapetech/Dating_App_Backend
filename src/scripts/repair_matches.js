import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/src/.env
dotenv.config({ path: path.join(__dirname, '../server/.env') });

import Match from '../server/src/models/Match.js';
import Like from '../server/src/models/Like.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function repair() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to DB for repair...');

  const matches = await Match.find({ status: 'active' });
  console.log(`Analyzing ${matches.length} active matches for inactivity...`);

  let count = 0;
  const now = new Date();

  for (const match of matches) {
    // Logic: If createdAt is old AND lastMessageAt is null/old, it should be expired.
    // Legitimate re-matches have a RECENT createdAt, so they won't be touched.
    const lastInteractionTime = (match.lastMessageAt && match.lastMessageAt > match.createdAt)
      ? new Date(match.lastMessageAt)
      : new Date(match.createdAt);

    const diff = now.getTime() - lastInteractionTime.getTime();
    const isExpired = diff > SEVEN_DAYS_MS;

    if (isExpired) {
      console.log(`[Match ${match._id}] Inactivity: ${Math.round(diff / (1000 * 60 * 60 * 24))} days. Re-expiring...`);
      
      match.status = 'expired';
      match.chatEnabled = false;
      await match.save();
      
      // Reset likes so that any fresh "Likes" from these users show up correctly in "People Who Liked You"
      const res = await Like.deleteMany({
        $or: [
          { senderId: match.users[0], receiverId: match.users[1] },
          { senderId: match.users[1], receiverId: match.users[0] },
        ],
      });

      count++;
    }
  }

  console.log(`\n✅ REPAIR COMPLETE`);
  console.log(`-----------------------------------`);
  console.log(`Matches restored to 'expired': ${count}`);
  console.log(`The 'Previous Interactions' list and 'People Who Liked You' screen should now be correct.`);
  
  await mongoose.connection.close();
  process.exit(0);
}

repair().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
