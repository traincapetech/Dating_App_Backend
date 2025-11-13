import {storage} from '../storage/index.js';

const USERS_PATH = 'data/users.json';

export async function getUsers() {
  return storage.readJson(USERS_PATH, []);
}

export async function findUserByEmail(email) {
  const users = await getUsers();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(user) {
  const users = await getUsers();
  users.push(user);
  await storage.writeJson(USERS_PATH, users);
  return user;
}

