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

export async function findUserById(userId) {
  const users = await getUsers();
  return users.find(user => user.id === userId);
}

export async function deleteUser(userId) {
  const users = await getUsers();
  const filtered = users.filter(user => user.id !== userId);
  await storage.writeJson(USERS_PATH, filtered);
  return true;
}

export async function updateUser(userId, updates) {
  const users = await getUsers();
  const index = users.findIndex(user => user.id === userId);
  if (index === -1) {
    return null;
  }
  const updatedUser = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  users[index] = updatedUser;
  await storage.writeJson(USERS_PATH, users);
  return updatedUser;
}

