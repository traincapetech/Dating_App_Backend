import mongoose from 'mongoose';
import {getPlanDetails as getPlanDetailsFromConfig} from '../config/subscriptionPlans.js';

const subscriptionSchema = new mongoose.Schema(
  {
    id: {type: String, required: true, unique: true, index: true},
    userId: {type: String, required: true, index: true},
    planId: {type: String, required: true},
    productId: {type: String},
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'refunded', 'payment_failed'],
      default: 'active',
      index: true,
    },
    paymentMethod: {type: String, default: 'in_app'},
    paymentGateway: {type: String, default: 'revenuecat'},
    transactionId: {type: String, sparse: true, index: true},
    orderId: {type: String, sparse: true, index: true},
    purchaseToken: {type: String, sparse: true, index: true},
    currency: {type: String, default: 'USD'},
    amount: {type: Number, default: 0},
    autoRenew: {type: Boolean, default: true},
    startedAt: {type: Date, default: Date.now},
    expiresAt: {type: Date, required: true, index: true},
    cancelledAt: {type: Date, default: null},
    expiredAt: {type: Date, default: null},
    refundedAt: {type: Date, default: null},
    metadata: {type: mongoose.Schema.Types.Mixed, default: {}},
  },
  {
    timestamps: true,
  },
);

subscriptionSchema.index({userId: 1, updatedAt: -1});

const SubscriptionModel =
  mongoose.models.Subscription ||
  mongoose.model('Subscription', subscriptionSchema);

export default SubscriptionModel;

export async function getSubscriptions() {
  return SubscriptionModel.find({}).sort({updatedAt: -1}).lean();
}

export async function findSubscriptionByUserId(userId) {
  if (!userId) return null;
  const searchId = String(userId);
  return SubscriptionModel.findOne({
    userId: searchId,
    status: {$in: ['active', 'cancelled', 'payment_failed']},
  })
    .sort({updatedAt: -1})
    .lean();
}

export async function findSubscriptionById(subscriptionId) {
  if (!subscriptionId) return null;
  return SubscriptionModel.findOne({id: subscriptionId}).lean();
}

export async function findSubscriptionByTransactionId(transactionId) {
  if (!transactionId) return null;
  return SubscriptionModel.findOne({
    $or: [{transactionId}, {orderId: transactionId}],
  }).lean();
}

export async function createSubscription(subscription) {
  const id =
    subscription.id ||
    `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const doc = await SubscriptionModel.create({
    ...subscription,
    id,
  });
  return doc.toObject();
}

export async function updateSubscription(subscriptionId, updates) {
  if (!subscriptionId) return null;
  return SubscriptionModel.findOneAndUpdate(
    {id: subscriptionId},
    {$set: updates},
    {new: true},
  ).lean();
}

export async function cancelSubscription(subscriptionId) {
  return updateSubscription(subscriptionId, {
    status: 'cancelled',
    autoRenew: false,
    cancelledAt: new Date(),
  });
}

export async function getAllUserSubscriptions(userId) {
  if (!userId) return [];
  return SubscriptionModel.find({userId: String(userId)})
    .sort({createdAt: -1})
    .lean();
}

export async function findSubscriptionByPurchaseToken(purchaseToken) {
  if (!purchaseToken) return null;
  return SubscriptionModel.findOne({purchaseToken}).lean();
}

export async function isUserPremium(userId) {
  // Free launch mode: unlock all features until ENABLE_PAYMENTS=true is explicitly set
  if (process.env.ENABLE_PAYMENTS !== 'true') {
    return true;
  }

  const subscription = await findSubscriptionByUserId(userId);
  if (!subscription) {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(subscription.expiresAt);

  if (expiresAt < now) {
    await updateSubscription(subscription.id, {
      status: 'expired',
      expiredAt: now,
    });

    const {updateUser} = await import('./userModel.js');
    await updateUser(userId, {
      isPremium: false,
      premiumExpiresAt: null,
    });

    return false;
  }

  return subscription.status === 'active' || subscription.status === 'cancelled';
}

export function getPlanDetails(planId) {
  return getPlanDetailsFromConfig(planId);
}
