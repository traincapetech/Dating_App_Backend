import express from 'express';
import {
  getGifts,
  getWallet,
  sendGift,
  convertGift,
  createWalletOrder,
  verifyWalletPayment,
} from '../controllers/giftController.js';

const router = express.Router();

// Get available gifts catalog
router.get('/', getGifts);

// Get user wallet and inventory
router.get('/wallet/:userId', getWallet);

// Send a gift to another user
router.post('/send', sendGift);

// Convert a received gift back to coins
router.post('/convert', convertGift);

// Wallet top-up via real payment
router.post('/wallet/topup/create', createWalletOrder);
router.post('/wallet/topup/verify', verifyWalletPayment);

export default router;
