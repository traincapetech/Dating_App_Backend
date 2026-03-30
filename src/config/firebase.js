import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

dotenv.config();

/**
 * Initialize Firebase Admin SDK
 * 
 * Supports both JSON environment variable and serviceAccountKey.json file
 */
const initializeFirebase = () => {
  try {
    if (admin.apps.length > 0) return admin;

    let serviceAccount;

    // Method 1: FIREBASE_SERVICE_ACCOUNT JSON string in .env
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    // Method 2: Path to serviceAccountKey.json
    else {
      const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
      try {
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      } catch (err) {
        console.warn('⚠️ No Firebase service account found. Push notifications will fail.');
        return null;
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    }

    return admin;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    return null;
  }
};

const firebaseAdmin = initializeFirebase();

export default firebaseAdmin;
