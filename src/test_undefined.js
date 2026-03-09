/**
 * Test what happens when userId is 'undefined' string
 */
import mongoose from 'mongoose';
import Match from './models/Match.js';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

const API_BASE = 'http://192.168.1.159:3000/api';

async function run() {
  console.log('Testing GET /api/match/undefined');
  try {
    const res = await fetch(`${API_BASE}/match/undefined`);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Check DB directly for 'undefined' string
  await mongoose.connect(process.env.MONGO_URI);
  const matches = await Match.find({users: 'undefined'});
  console.log(`Matches found for string 'undefined': ${matches.length}`);

  process.exit(0);
}
run();
