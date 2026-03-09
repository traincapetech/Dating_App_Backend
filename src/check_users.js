import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({path: path.join(__dirname, '../.env')});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    const db = mongoose.connection.db;

    const users = await db.collection('users').find({}).toArray();
    const profiles = await db.collection('profiles').find({}).toArray();

    console.log('--- TARGET USERS ---');
    for (const u of users) {
      if (
        u.fullName?.match(/karma/i) ||
        u.fullName?.match(/jordan/i) ||
        u.fullName?.match(/gaurav/i)
      ) {
        console.log(`[User] ID: ${u._id} | Name: ${u.fullName}`);
      }
    }

    console.log('--- TARGET PROFILES ---');
    for (const p of profiles) {
      const fName = p.basicInfo?.firstName || '';
      if (
        fName.match(/karma/i) ||
        fName.match(/jordan/i) ||
        fName.match(/gaurav/i)
      ) {
        console.log(`[Profile] UserID: ${p.userId} | Name: ${fName}`);
      }
    }

    await mongoose.disconnect();
  })
  .catch(e => console.error(e));
