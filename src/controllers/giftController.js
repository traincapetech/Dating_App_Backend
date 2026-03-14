import Gift from '../models/Gift.js';
import Wallet from '../models/Wallet.js';
import GiftTransaction from '../models/GiftTransaction.js';
import Message from '../models/Message.js';
import Match from '../models/Match.js';
import Block from '../models/Block.js';
import {getIO, emitToUser} from '../services/socketService.js';
import eventEmitter from '../modules/streak/eventEmitter.js';
import mongoose from 'mongoose';
import {createPaymentOrder, verifyPayment} from '../services/paymentService.js';

// Helper to verify match access (copied from messageController for consistency)
async function verifyMatchAccess(matchId, userId) {
  const match = await Match.findById(matchId);
  if (!match) {
    return {error: 'Match not found', status: 404};
  }
  if (!match.users.includes(userId)) {
    return {
      error: 'Access denied: You are not part of this match',
      status: 403,
    };
  }
  return {match};
}

// Helper to check if blocked
async function checkBlocked(userId1, userId2) {
  const block = await Block.findOne({
    $or: [
      {blockerId: userId1, blockedId: userId2},
      {blockerId: userId2, blockedId: userId1},
    ],
  });
  return !!block;
}

export const getGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({isActive: true}).sort({coinValue: 1});
    res.json({success: true, gifts});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
};

export const getWallet = async (req, res) => {
  try {
    const {userId} = req.params;
    let wallet = await Wallet.findOne({userId}).populate('inventory.giftId');

    if (!wallet) {
      wallet = await Wallet.create({userId, coinsBalance: 100}); // Give 100 free coins for testing
    }

    res.json({success: true, wallet});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
};

export const sendGift = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {matchId, senderId, receiverId, giftId} = req.body;

    if (!matchId || !senderId || !receiverId || !giftId) {
      return res
        .status(400)
        .json({success: false, message: 'All fields are required'});
    }

    // 1. Verify match and blocks
    const access = await verifyMatchAccess(matchId, senderId);
    if (access.error) throw new Error(access.error);

    const isBlocked = await checkBlocked(senderId, receiverId);
    if (isBlocked) throw new Error('Cannot send gifts - user blocked');

    // 2. Fetch Gift and Wallet
    const gift = await Gift.findById(giftId).session(session);
    if (!gift) throw new Error('Gift not found');

    let senderWallet = await Wallet.findOne({userId: senderId}).session(
      session,
    );
    if (!senderWallet) {
      senderWallet = await Wallet.create(
        [{userId: senderId, coinsBalance: 0}],
        {
          session,
        },
      );
      senderWallet = senderWallet[0];
    }

    if (senderWallet.coinsBalance < gift.coinValue) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient coins',
        required: gift.coinValue,
        balance: senderWallet.coinsBalance,
      });
    }

    // 3. Deduct coins from sender
    senderWallet.coinsBalance -= gift.coinValue;
    await senderWallet.save({session});

    // 4. Add gift to receiver inventory
    let receiverWallet = await Wallet.findOne({userId: receiverId}).session(
      session,
    );
    if (!receiverWallet) {
      receiverWallet = await Wallet.create(
        [{userId: receiverId, coinsBalance: 0}],
        {session},
      );
      receiverWallet = receiverWallet[0];
    }

    receiverWallet.inventory.push({
      giftId: gift._id,
      senderId: senderId,
      count: 1,
      receivedAt: new Date(),
    });
    await receiverWallet.save({session});

    // 5. Create Transaction Log
    await GiftTransaction.create(
      [
        {
          senderId,
          receiverId,
          giftId: gift._id,
          type: 'gift_send',
          coinAmount: gift.coinValue,
          status: 'completed',
        },
      ],
      {session},
    );

    // 6. Create Chat Message
    const message = await Message.create(
      [
        {
          matchId,
          senderId,
          receiverId,
          mediaType: 'gift',
          giftMetadata: {
            giftId: gift._id,
            name: gift.name,
            slug: gift.slug,
            coinValue: gift.coinValue,
            imageUrl: gift.imageUrl,
          },
          status: 'sent',
        },
      ],
      {session},
    );

    await session.commitTransaction();

    // 7. Emit events (Outside transaction for speed/reliability)
    const io = getIO();
    if (io) {
      io.to(matchId).emit('receiveMessage', message[0]);
    }

    // 🔥 Trigger Streak Integration
    eventEmitter.emit('activity:engagement', {
      fromUser: senderId,
      toUser: receiverId,
      type: 'gift',
    });

    res.json({
      success: true,
      message: message[0],
      balance: senderWallet.coinsBalance,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('[Gift Error]:', error);
    res.status(500).json({success: false, message: error.message});
  } finally {
    session.endSession();
  }
};

export const convertGift = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {userId, inventoryItemId} = req.body;

    const wallet = await Wallet.findOne({userId}).session(session);
    if (!wallet) throw new Error('Wallet not found');

    const itemIndex = wallet.inventory.findIndex(
      item => item._id.toString() === inventoryItemId && !item.isConverted,
    );

    if (itemIndex === -1)
      throw new Error('Gift not found or already converted');

    const inventoryItem = wallet.inventory[itemIndex];
    const gift = await Gift.findById(inventoryItem.giftId).session(session);

    if (!gift) throw new Error('Gift definition not found');

    // Update wallet
    wallet.coinsBalance += gift.coinValue;
    wallet.inventory[itemIndex].isConverted = true;
    wallet.inventory[itemIndex].convertedAt = new Date();
    await wallet.save({session});

    // Log transaction
    await GiftTransaction.create(
      [
        {
          senderId: userId,
          type: 'gift_convert',
          giftId: gift._id,
          coinAmount: gift.coinValue,
          status: 'completed',
        },
      ],
      {session},
    );

    await session.commitTransaction();
    res.json({success: true, newBalance: wallet.coinsBalance});
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({success: false, message: error.message});
  } finally {
    session.endSession();
  }
};

// Create payment order for wallet top-up
export const createWalletOrder = async (req, res) => {
  try {
    const {userId, amount, currency, country} = req.body;

    if (!userId || !amount) {
      return res
        .status(400)
        .json({success: false, message: 'User ID and amount are required'});
    }

    // 1 INR = 1 Coin rule
    const paymentCurrency = currency || 'INR';
    const coinAmount = amount; // 1:1 ratio

    // Convert to smallest currency unit (paise for INR, cents for USD)
    const paymentAmount = Math.round(amount * 100);

    const paymentOrder = await createPaymentOrder(
      userId,
      'wallet_topup',
      paymentAmount,
      paymentCurrency,
      country,
    );

    res.json({
      success: true,
      paymentOrder,
      coins: coinAmount,
    });
  } catch (error) {
    console.error('[Wallet Order Error]:', error);
    res.status(500).json({success: false, message: error.message});
  }
};

// Verify wallet top-up payment
export const verifyWalletPayment = async (req, res) => {
  try {
    const {
      userId,
      amount,
      orderId,
      paymentId,
      signature,
      gateway,
      currency,
      additionalData,
    } = req.body;

    if (!userId || !amount || !orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details',
      });
    }

    // Verify payment
    const verification = await verifyPayment(
      gateway,
      orderId,
      paymentId,
      signature,
      additionalData,
    );

    console.log('[Wallet Verify] Result:', verification);

    if (!verification.success || !verification.verified) {
      // In non-production environments, allow wallet topup to proceed even if
      // gateway verification fails, so developers can test the flow without
      // fully wired payment credentials.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[Wallet Verify] Verification failed in non-production, bypassing for dev:',
          verification,
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          verification,
        });
      }
    }

    // Atomic update to wallet
    const wallet = await Wallet.findOneAndUpdate(
      {userId},
      {$inc: {coinsBalance: amount}},
      {upsert: true, returnDocument: 'after'},
    );

    // Log transaction
    await GiftTransaction.create([
      {
        senderId: userId,
        type: 'wallet_topup',
        coinAmount: amount,
        status: 'completed',
        paymentInfo: {
          gateway,
          paymentId,
          orderId,
        },
      },
    ]);

    res.json({
      success: true,
      newBalance: wallet.coinsBalance,
      message: `${amount} coins added to your wallet`,
    });
  } catch (error) {
    console.error('[Wallet Verify Error]:', error);
    res.status(500).json({success: false, message: error.message});
  }
};

// Internal testing helper to add coins (Keeping for internal but removing from public routes later)
export const addCoins = async (req, res) => {
  try {
    const {userId, amount} = req.body;
    const wallet = await Wallet.findOneAndUpdate(
      {userId},
      {$inc: {coinsBalance: amount || 100}},
      {upsert: true, new: true},
    );
    res.json({success: true, balance: wallet.coinsBalance});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
};
