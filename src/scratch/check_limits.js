import mongoose from 'mongoose';
import DailyLikeCount from '../models/DailyLikeCount.js';
import User from '../models/User.js';
import {config} from '../config/env.js';
import {storage} from '../storage/index.js';

async function check() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to DB');

  const counts = await DailyLikeCount.find({}).sort({date: -1, count: -1}).limit(20);
  
  const subscriptions = await storage.readJson('data/subscriptions.json', []);
  console.log('Total Subscriptions found:', subscriptions.length);

  const uniqueUserIds = [...new Set(counts.map(c => c.userId))];
  const users = await User.find({_id: { $in: uniqueUserIds }});

  console.log('\n--- User Status ---');
  uniqueUserIds.forEach(uid => {
    const user = users.find(u => String(u._id) === String(uid));
    const userSub = subscriptions.filter(s => String(s.userId) === String(uid));
    const activeSub = userSub.find(s => s.status === 'active' || s.status === 'cancelled' || s.status === 'payment_failed');
    
    let isPremium = false;
    if (activeSub) {
      const expiresAt = new Date(activeSub.expiresAt);
      if (isNaN(expiresAt) || expiresAt > new Date()) {
        isPremium = true;
      }
    }

    console.log(`User: ${uid}`);
    console.log(`  Name: ${user ? user.fullName : 'Unknown'}`);
    console.log(`  Premium (Logic): ${isPremium}`);
    console.log(`  Premium (User Object): ${user ? user.isPremium : 'N/A'}`);
    console.log(`  Count for today: ${counts.find(c => c.userId === uid && c.date === '2026-04-10')?.count || 0}`);
    if (activeSub) {
      console.log(`  Active Sub Found: ${activeSub.id}, Status: ${activeSub.status}, Expires: ${activeSub.expiresAt}`);
    } else {
      console.log('  No Active Sub found in JSON');
    }
  });

  await mongoose.disconnect();
}

check();
