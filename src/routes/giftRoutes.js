import express from 'express';
import {
  getGifts,
  getWallet,
  sendGift,
  convertGift,
  createWalletOrder,
  verifyWalletPayment,
} from '../controllers/giftController.js';

import {requireAuth} from '../middlewares/auth.js';

const router = express.Router();

const requirePaymentsEnabled = (_req, res, next) => {
  if (process.env.ENABLE_PAYMENTS !== 'true') {
    return res.status(503).json({
      success: false,
      message: 'Wallet and gift purchases are disabled in this free release.',
    });
  }
  return next();
};

// Get available gifts catalog
router.get('/', getGifts);

// Protected wallet & gift actions (disabled while ENABLE_PAYMENTS !== 'true')
router.use(requireAuth);
router.use(requirePaymentsEnabled);

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
