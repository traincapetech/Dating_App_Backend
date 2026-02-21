import User from './User.js';

// Adapter functions to map old file-system API to new Mongoose API

export async function getUsers() {
  const users = await User.find({});
  return users.map(user => user.toObject());
}

export async function findUserByEmail(email) {
  const user = await User.findOne({email: email.toLowerCase()});
  return user ? user.toObject() : undefined;
}

export async function createUser(userData) {
  const data = {...userData};
  if (data.id && !data._id) {
    data._id = data.id;
  }

  const newUser = new User(data);
  await newUser.save();
  return newUser.toObject();
}

export async function findUserById(userId) {
  const user = await User.findById(userId);
  return user ? user.toObject() : undefined;
}

export async function deleteUser(userId) {
  const result = await User.findByIdAndDelete(userId);
  return !!result;
}

export async function findUserByGoogleId(googleId) {
  const user = await User.findOne({googleId});
  return user ? user.toObject() : undefined;
}

export async function updateUser(userId, updates) {
  const safeUpdates = {...updates};
  delete safeUpdates.id;
  delete safeUpdates._id;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {$set: safeUpdates},
    {new: true, runValidators: true},
  );

  return updatedUser ? updatedUser.toObject() : null;
}
