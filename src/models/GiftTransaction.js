import mongoose from 'mongoose';

const giftTransactionSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: String, // Can be null for admin_topup or pack_purchase
      ref: 'User',
      index: true,
    },
    giftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gift',
    },
    type: {
      type: String,
      enum: [
        'gift_send',
        'gift_convert',
        'coin_purchase',
        'admin_topup',
        'wallet_topup',
      ],
      required: true,
    },
    coinAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    paymentInfo: {
      gateway: String,
      paymentId: String,
      orderId: String,
      signature: String,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  },
);

const GiftTransaction =
  mongoose.models.GiftTransaction ||
  mongoose.model('GiftTransaction', giftTransactionSchema);

export default GiftTransaction;
