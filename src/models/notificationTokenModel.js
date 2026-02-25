import mongoose from 'mongoose';

const notificationTokenSchema = new mongoose.Schema(
  {
    userId: {type: String, required: true, index: true},
    deviceToken: {type: String, required: true},
    platform: {type: String, default: 'unknown'},
  },
  {timestamps: true},
);

const NotificationToken =
  mongoose.models.NotificationToken ||
  mongoose.model('NotificationToken', notificationTokenSchema);

export async function getNotificationTokens() {
  return await NotificationToken.find({});
}

export async function findTokenByUserId(userId) {
  return await NotificationToken.findOne({userId});
}

export async function findTokenByDeviceToken(deviceToken) {
  return await NotificationToken.findOne({deviceToken});
}

export async function registerToken(userId, deviceToken, platform = 'unknown') {
  return await NotificationToken.findOneAndUpdate(
    {userId},
    {deviceToken, platform},
    {new: true, upsert: true},
  );
}

export async function unregisterToken(userId) {
  await NotificationToken.deleteMany({userId});
  return true;
}

export async function getTokensByUserIds(userIds) {
  return await NotificationToken.find({userId: {$in: userIds}});
}
