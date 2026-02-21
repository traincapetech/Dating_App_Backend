import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pryvo';
const SALT_ROUNDS = 10;

async function createUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    const email = 'blacksaura2@gmail.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const existing = await User.findOne({email});
    if (existing) {
      console.log('User already exists, updating password...');
      existing.password = hashedPassword;
      await existing.save();
      console.log('✅ Password updated to: password123');
    } else {
      const newUser = new User({
        _id: 'manual_restore_' + Date.now(),
        fullName: 'Restored User',
        email: email,
        password: hashedPassword,
        role: 'user',
        isVerified: true,
      });
      await newUser.save();
      console.log('✅ User created with password: password123');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createUser();
