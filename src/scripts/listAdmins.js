import {getAdmins} from '../models/Admin.js';
import pkg from 'dotenv';
const { config } = pkg;
config();

async function list() {
  try {
    const admins = await getAdmins();
    console.log('Admins found:', admins.length);
    admins.forEach(a => {
      console.log(`- ${a.email} (${a.role})`);
    });
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

list();
