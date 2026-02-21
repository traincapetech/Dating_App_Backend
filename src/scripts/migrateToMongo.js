import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import {r2Driver} from '../storage/drivers/r2.js';
import {config} from '../config/env.js';

// Load env vars
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo';

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    console.log(`🔍 Storage Driver: ${config.storageDriver}`);
    console.log(`📦 Bucket: ${config.r2.bucket}`);

    // 1. Migrate Users
    console.log('☁️ Downloading users.json from R2...');
    let users = [];
    try {
      users = await r2Driver.readJson('data/users.json');
      if (!users) users = [];
    } catch (e) {
      console.warn('⚠️ Could not read users.json from R2:', e.message);
    }

    console.log(`Found ${users.length} users in R2.`);

    let userCount = 0;
    for (const user of users) {
      if (!user.id) continue;

      const exists = await User.findById(user.id);
      if (exists) {
        // console.log(`Skipping existing user: ${user.email}`);
        continue;
      }

      // Map JSON fields to Mongoose Schema
      const newUser = new User({
        _id: user.id, // Map UUID to _id
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role || 'user',
        isVerified: user.isVerified || false,
        passwordResetToken: user.passwordResetToken,
        passwordResetExpires: user.passwordResetExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt || user.createdAt,
      });

      await newUser.save();
      userCount++;
    }
    console.log(`🎉 Migrated ${userCount} new users.`);

    // 2. Migrate Profiles
    console.log('☁️ Downloading profiles.json from R2...');
    let profiles = [];
    try {
      profiles = await r2Driver.readJson('data/profiles.json');
      if (!profiles) profiles = [];
    } catch (e) {
      console.warn('⚠️ Could not read profiles.json from R2:', e.message);
    }

    console.log(`Found ${profiles.length} profiles in R2.`);

    let profileCount = 0;
    for (const profile of profiles) {
      if (!profile.id) continue;

      // Extract location from basicInfo if available
      let geoJsonLocation = {type: 'Point', coordinates: [0, 0]};

      // Check basicInfo.location string "lat, lng"
      if (
        profile.basicInfo?.location &&
        typeof profile.basicInfo.location === 'string'
      ) {
        const parts = profile.basicInfo.location.split(',').map(s => s.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            // MongoDB GeoJSON is [lng, lat]
            geoJsonLocation = {type: 'Point', coordinates: [lng, lat]};
          }
        }
      }

      // Prepare Update Object
      const updateData = {
        userId: profile.userId,
        basicInfo: profile.basicInfo,
        datingPreferences: profile.datingPreferences,
        lifestyle: profile.lifestyle,
        personalDetails: profile.personalDetails,
        profilePrompts: profile.profilePrompts,
        media: profile.media,
        location: geoJsonLocation, // Valid GeoJSON
        isPaused: profile.isPaused,
        isHidden: profile.isHidden,
        moderationStatus: profile.moderationStatus,
        moderationFlags: profile.moderationFlags,
        moderationRiskScore: profile.moderationRiskScore,
        autoReviewedAt: profile.autoReviewedAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt || profile.createdAt,
      };

      // Upsert: Create if new, Update if exists
      await Profile.findOneAndUpdate(
        {_id: profile.id},
        {$set: updateData},
        {upsert: true, new: true, runValidators: true},
      );

      profileCount++;
    }
    console.log(`🎉 Migrated/Updated ${profileCount} profiles.`);

    console.log('🏁 Migration Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

migrate();
