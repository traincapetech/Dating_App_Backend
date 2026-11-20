import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  createSubscription,
  findSubscriptionByUserId,
  updateSubscription,
} from '../models/Subscription.js';
import {updateUser} from '../models/userModel.js';
import Wallet from '../models/Wallet.js';
import GiftTransaction from '../models/GiftTransaction.js';

// Map Google Play / App Store consumable product IDs to coin amounts
const COIN_PRODUCT_MAP = {
  pryvo_coins_50: 50,
  pryvo_coins_100: 100,
  pryvo_coins_200: 200,
  pryvo_coins_500: 500,
};

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * POST /api/subscription/webhooks/revenuecat
 * Configure RevenueCat Dashboard -> Webhooks -> Authorization Header:
 *   Bearer <REVENUECAT_WEBHOOK_AUTH>
 */
export const revenueCatWebhookController = async (req, res) => {
  try {
    const expectedSecret = process.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expectedSecret) {
      console.error('[RevenueCat] REVENUECAT_WEBHOOK_AUTH is not configured');
      return res.status(500).json({success: false, message: 'Webhook auth not configured'});
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (!safeCompare(token, expectedSecret)) {
      return res.status(401).json({success: false, message: 'Unauthorized webhook'});
    }

    const event = req.body?.event;
    if (!event || !event.type || !event.app_user_id) {
      return res.status(400).json({success: false, message: 'Invalid RevenueCat event payload'});
    }

    const userId = String(event.app_user_id);
    const productId = String(event.product_id || '');
    const eventId = String(event.id || event.transaction_id || '');
    const expiresAt = event.expiration_at_ms
      ? new Date(Number(event.expiration_at_ms))
      : null;

    // 1. Handle consumable Wallet Coin packs (NON_RENEWING_PURCHASE)
    if (event.type === 'NON_RENEWING_PURCHASE' && COIN_PRODUCT_MAP[productId]) {
      const coins = COIN_PRODUCT_MAP[productId];

      // Idempotency check: prevent duplicate webhook credits
      const existingTx = await GiftTransaction.findOne({
        'metadata.rcEventId': eventId,
      });
      if (existingTx) {
        return res.status(200).json({success: true, deduplicated: true});
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Wallet.findOneAndUpdate(
          {userId},
          {$inc: {coinsBalance: coins}},
          {upsert: true, new: true, session},
        );

        await GiftTransaction.create(
          [
            {
              senderId: userId,
              receiverId: userId,
              type: 'topup',
              coinValue: coins,
              status: 'completed',
              metadata: {
                rcEventId: eventId,
                productId,
                store: event.store,
                transactionId: event.transaction_id,
              },
            },
          ],
          {session},
        );

        await session.commitTransaction();
      } catch (txErr) {
        await session.abortTransaction();
        throw txErr;
      } finally {
        session.endSession();
      }

      return res.status(200).json({success: true, creditedCoins: coins});
    }

    // 2. Handle Subscriptions (Google Play / App Store via RevenueCat)
    const activeEvents = new Set([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'PRODUCT_CHANGE',
      'UNCANCELLATION',
    ]);

    if (activeEvents.has(event.type) && expiresAt) {
      const existingSub = await findSubscriptionByUserId(userId);
      if (existingSub) {
        await updateSubscription(existingSub.id, {
          planId: productId || existingSub.planId,
          productId,
          status: 'active',
          autoRenew: true,
          expiresAt,
          paymentGateway: 'revenuecat',
          transactionId: event.transaction_id || existingSub.transactionId,
        });
      } else {
        await createSubscription({
          userId,
          planId: productId,
          productId,
          status: 'active',
          paymentMethod: 'in_app',
          paymentGateway: 'revenuecat',
          transactionId: event.transaction_id || eventId,
          currency: event.currency || 'USD',
          amount: Number(event.price || 0),
          autoRenew: true,
          expiresAt,
        });
      }

      await updateUser(userId, {
        isPremium: true,
        premiumExpiresAt: expiresAt,
      });
    } else if (event.type === 'CANCELLATION') {
      const existingSub = await findSubscriptionByUserId(userId);
      if (existingSub) {
        await updateSubscription(existingSub.id, {
          status: 'cancelled',
          autoRenew: false,
          cancelledAt: new Date(),
        });
      }
    } else if (event.type === 'EXPIRATION') {
      const existingSub = await findSubscriptionByUserId(userId);
      if (existingSub) {
        await updateSubscription(existingSub.id, {
          status: 'expired',
          autoRenew: false,
          expiredAt: new Date(),
        });
      }
      await updateUser(userId, {
        isPremium: false,
        premiumExpiresAt: null,
      });
    } else if (event.type === 'BILLING_ISSUE') {
      const existingSub = await findSubscriptionByUserId(userId);
      if (existingSub) {
        await updateSubscription(existingSub.id, {status: 'payment_failed'});
      }
    }

    return res.status(200).json({success: true});
  } catch (error) {
    console.error('[RevenueCat Webhook] Error:', error.message);
    return res.status(500).json({success: false, message: 'Webhook processing failed'});
  }
};
