const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({path: './.env'});

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Profile = require('./src/models/Profile.js').default;
  const user = await Profile.findOne({ 'basicInfo.firstName': 'Harsh' });
  console.log(JSON.stringify(user, null, 2));
  process.exit(0);
}
check().catch(console.error);
