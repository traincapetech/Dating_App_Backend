import {r2Driver} from '../storage/drivers/r2.js';
import {config} from '../config/env.js';

async function fetchSample() {
  try {
    const profiles = await r2Driver.readJson('data/profiles.json');
    if (profiles && profiles.length > 0) {
      console.log('Sample Profile:');
      console.dir(profiles[0], {depth: null});
    } else {
      console.log('No profiles found in R2.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchSample();
