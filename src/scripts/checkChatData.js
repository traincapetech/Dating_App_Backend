import {r2Driver} from '../storage/drivers/r2.js';
import {config} from '../config/env.js';

async function checkChatData() {
  console.log('🔍 Checking R2 for Chat Data...');

  try {
    const matches = await r2Driver.readJson('data/matches.json');
    if (matches) {
      console.log(
        `✅ Found matches.json in R2! Contains ${matches.length} matches.`,
      );
    } else {
      console.log('❌ matches.json not found in R2.');
    }
  } catch (error) {
    console.log('❌ Error reading matches.json:', error.message);
  }

  try {
    const messages = await r2Driver.readJson('data/messages.json');
    if (messages) {
      console.log(
        `✅ Found messages.json in R2! Contains ${messages.length} messages.`,
      );
    } else {
      console.log('❌ messages.json not found in R2.');
    }
  } catch (error) {
    console.log('❌ Error reading messages.json:', error.message);
  }
}

checkChatData();
