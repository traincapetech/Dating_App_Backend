import mongoose from 'mongoose';
import Profile from '../models/Profile.js';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo';

async function inspectProfile() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    const profile = await Profile.findOne({});
    if (profile) {
      console.log('🔍 Sample Profile Data:');
      console.log('ID:', profile.id);
      console.log('Basic Info Location:', profile.basicInfo?.location);
      console.log(
        'Basic Info LocationDetails:',
        profile.basicInfo?.locationDetails,
      );
      console.log('GeoJSON Location:', JSON.stringify(profile.location));
    } else {
      console.log('❌ No profiles found.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

inspectProfile();
