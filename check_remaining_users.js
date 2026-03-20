import 'dotenv/config';
import mongoose from 'mongoose';
import './src/models/User.js';

const User = mongoose.model('User');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}, 'email fullName').limit(100);
  console.log('Sample users:');
  users.forEach(u => console.log(`${u.fullName} - ${u.email}`));

  const suspicious = await User.find({
    $or: [
      {email: /test/i},
      {email: /dummy/i},
      {fullName: /test/i},
      {fullName: /dummy/i},
    ],
  });

  console.log(`\nFound ${suspicious.length} suspicious users:`);
  suspicious.forEach(u => console.log(`${u.fullName} - ${u.email}`));

  await mongoose.disconnect();
}

main().catch(console.error);
