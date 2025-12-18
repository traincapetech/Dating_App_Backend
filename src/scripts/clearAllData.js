import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function clearAllData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const collections = [
      'users',
      'profiles', 
      'matches',
      'messages',
      'likes',
      'otps',
      'blocks',
      'reports',
      'notificationtokens'
    ];

    for (const collection of collections) {
      try {
        const result = await mongoose.connection.db.collection(collection).deleteMany({});
        console.log(`✓ Deleted ${result.deletedCount} documents from ${collection}`);
      } catch (e) {
        console.log(`- Collection ${collection} doesn't exist or empty`);
      }
    }

    console.log('\n✅ All data cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

clearAllData();

