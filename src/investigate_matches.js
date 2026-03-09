import mongoose from 'mongoose';
import Like from './models/Like.js';
import Match from './models/Match.js';
import Profile from './models/Profile.js';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

const API_BASE = 'http://192.168.1.159:3000/api';
const KARMA_PROFILE_USERID = '5e54b7bf-26e0-4c2e-913a-a546e6557182';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Check User document
  const karmaUser = await User.findById(KARMA_PROFILE_USERID);
  if (karmaUser) {
    const o1 = karmaUser.toObject();
    const o2 = karmaUser.toObject({virtuals: true});
    process.stdout.write(`toObject()._id=${o1._id} .id=${o1.id}\n`);
    process.stdout.write(`toObject({virtuals})._id=${o2._id} .id=${o2.id}\n`);
  } else {
    process.stdout.write(
      `Karma User NOT found by _id=${KARMA_PROFILE_USERID}\n`,
    );
    const allUsers = await User.find({}).lean();
    allUsers.forEach(u =>
      process.stdout.write(`  User: _id=${u._id} name=${u.fullName}\n`),
    );
  }

  // 2. Matches
  const matches = await Match.find({
    users: KARMA_PROFILE_USERID,
    chatEnabled: true,
  });
  process.stdout.write(`\nMatches (chatEnabled=true): ${matches.length}\n`);
  matches.forEach(m =>
    process.stdout.write(`  users=${JSON.stringify(m.users)}\n`),
  );

  // 3. Live API
  process.stdout.write('\nLive GET /api/match/' + KARMA_PROFILE_USERID + '\n');
  const r1 = await fetch(`${API_BASE}/match/${KARMA_PROFILE_USERID}`);
  const d1 = await r1.json();
  process.stdout.write(
    `status=${r1.status} success=${d1.success} matches.length=${d1.matches?.length}\n`,
  );
  if (d1.matches?.length > 0) {
    d1.matches.forEach(m =>
      process.stdout.write(`  theirId=${m.theirId} theirName=${m.theirName}\n`),
    );
  }

  // 4. Likes
  const likes = await Like.find({receiverId: KARMA_PROFILE_USERID});
  process.stdout.write(`\nLikes received by Karma: ${likes.length}\n`);
  likes.forEach(l => process.stdout.write(`  from=${l.senderId}\n`));

  const matchedIds = matches.map(m =>
    m.users.find(u => u !== KARMA_PROFILE_USERID),
  );
  const pending = likes.filter(l => !matchedIds.includes(l.senderId));
  process.stdout.write(`Pending likes (not matched): ${pending.length}\n`);

  process.exit(0);
}
run().catch(err => {
  process.stdout.write('ERROR: ' + err.message + '\n');
  process.exit(1);
});
