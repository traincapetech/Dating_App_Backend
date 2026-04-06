import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { broadcastPushNotification } from '../services/pushService.js';

async function runTest() {
  try {
    console.log('🚀 Connecting to MongoDB for push test...');
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected.');

    const testNotification = {
      title: '🔥 Live Match Event!',
      body: 'Someone special just became active! Tap to match in the next 15 minutes.',
      type: 'live',
      isHighPriority: true,
      data: {
        type: 'live',
        imageURL: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png', // Pikachu for test :)
        durationMinutes: 15,
        id: 'test_event_' + Date.now()
      }
    };

    console.log('📢 Broadcasting Meesho-style live notification to ALL registered devices...');
    const result = await broadcastPushNotification(testNotification);
    
    console.log('\n--- Broadcast Result ---');
    console.log(`✅ Success: ${result.successCount}`);
    console.log(`❌ Failure: ${result.failureCount}`);
    console.log('------------------------\n');

    if (result.successCount === 0) {
      console.warn('⚠️ No notifications were sent. Make sure your app is running and has registered for push notifications.');
    } else {
      console.log('🎉 Test push sent! Check your Android device/emulator.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
