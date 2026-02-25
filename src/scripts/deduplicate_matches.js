import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server directory
const envPath = path.join(__dirname, '../../.env');
dotenv.config({path: envPath});

const MatchSchema = new mongoose.Schema({}, {strict: false});
const Match = mongoose.model('Match', MatchSchema);

async function deduplicateMatches() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const matches = await Match.find();
    console.log(`Found ${matches.length} total matches.`);

    const seenPairs = new Map(); // pairKey -> matchId
    const toDelete = [];

    // Sort matches by createdAt descending to keep the most recent one
    const sortedMatches = [...matches].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    for (const match of sortedMatches) {
      if (!match.users || match.users.length < 2) {
        console.log(`Deleting invalid match: ${match._id}`);
        toDelete.push(match._id);
        continue;
      }

      // Create a unique key for the user pair (sorted to handle [A, B] and [B, A])
      const pairKey = [...match.users].sort().join(':');

      if (seenPairs.has(pairKey)) {
        console.log(
          `Found duplicate match for pair ${pairKey}: ${
            match._id
          } (Keeping ${seenPairs.get(pairKey)})`,
        );
        toDelete.push(match._id);
      } else {
        seenPairs.set(pairKey, match._id);
      }
    }

    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} duplicate matches...`);
      const result = await Match.deleteMany({_id: {$in: toDelete}});
      console.log(`Successfully deleted ${result.deletedCount} matches.`);
    } else {
      console.log('No duplicate matches found.');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

deduplicateMatches();
