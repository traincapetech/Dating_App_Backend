import { getAdmins } from './src/models/Admin.js';
import storage from './src/storage/index.js';

async function main() {
  const admins = await getAdmins();
  console.log(JSON.stringify(admins, null, 2));
}

main().catch(console.error);
