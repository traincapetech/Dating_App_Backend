import {storage} from '../storage/index.js';

const DATA_FILES = [
  'data/users.json',
  'data/profiles.json',
  'data/matches.json',
  'data/messages.json',
  'data/likes.json',
  'data/otps.json',
  'data/blocks.json',
  'data/reports.json',
  'data/notificationTokens.json',
];

async function clearAllData() {
  try {
    console.log('🗑️  Clearing all JSON data files...\n');

    for (const file of DATA_FILES) {
      try {
        await storage.writeJson(file, []);
        console.log(`✓ Cleared ${file}`);
      } catch (error) {
        console.log(`- ${file} doesn't exist or couldn't be cleared: ${error.message}`);
      }
    }

    console.log('\n✅ All data cleared successfully!');
    console.log('You can now create fresh accounts and profiles.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearAllData();

