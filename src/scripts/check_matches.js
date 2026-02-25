import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env');
dotenv.config({path: envPath});

const MatchSchema = new mongoose.Schema({}, {strict: false});
const Match = mongoose.model('Match', MatchSchema);

async function checkMatches() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const targetId = 'ca0a4734-5ea0-4e50-9882-9108a5a34d15';

    const matches = await Match.find({users: targetId});
    console.log(`Found ${matches.length} total matches for user ${targetId}`);

    matches.forEach((m, idx) => {
      console.log(`\nMatch ${idx + 1}:`);
      console.log(`- ID: ${m._id}`);
      console.log(`- Users: ${JSON.stringify(m.users)}`);
      console.log(`- Chat Enabled: ${m.chatEnabled}`);
      console.log(`- Status: ${m.status}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMatches();
