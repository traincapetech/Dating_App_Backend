import mongoose from 'mongoose';
import Match from './models/Match.js';
import Like from './models/Like.js';
import {getProfile} from './services/profileService.js';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

const karmaId = '5e54b7bf-26e0-4c2e-913a-a546e6557182';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const allMatches = await Match.find({users: karmaId, chatEnabled: true}).sort(
    {createdAt: -1},
  );
  process.stdout.write(`Matches found: ${allMatches.length}\n`);

  for (const match of allMatches) {
    const theirId = match.users.find(u => u !== karmaId);
    const now = new Date();
    const exp = match.expiresAt ? new Date(match.expiresAt) : null;
    const expired = match.status === 'active' && exp && now > exp;
    process.stdout.write(
      `Match: ${match._id} theirId=${theirId} status=${match.status} chatEnabled=${match.chatEnabled} expired=${expired} expiresAt=${exp}\n`,
    );

    const profile = await getProfile(theirId);
    process.stdout.write(
      `Profile: ${
        profile ? profile.name || profile.basicInfo?.firstName : 'NOT FOUND'
      }\n`,
    );
  }

  const likes = await Like.find({receiverId: karmaId});
  process.stdout.write(`Total likes received: ${likes.length}\n`);

  const allMatchDocs = await Match.find({users: karmaId});
  const matchedUserIds = allMatchDocs.map(m =>
    m.users.find(id => id !== karmaId),
  );
  process.stdout.write(`matchedUserIds: ${JSON.stringify(matchedUserIds)}\n`);

  const pending = likes.filter(l => !matchedUserIds.includes(l.senderId));
  process.stdout.write(`Pending likes: ${pending.length}\n`);

  process.exit(0);
}

run().catch(err => {
  process.stdout.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
