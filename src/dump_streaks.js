import mongoose from 'mongoose';
import Streak from './modules/streak/streak.model.js';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

async function debug() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const streaks = await Streak.find({streakCount: {$gt: 0}}).limit(5).lean();
  console.log('Streaks found:', JSON.stringify(streaks, null, 2));

  process.exit(0);
}

debug().catch(console.error);
