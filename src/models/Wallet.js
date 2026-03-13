import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    coinsBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Inventory of received gifts that can be converted
    inventory: [
      {
        giftId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Gift',
          required: true,
        },
        senderId: {
          type: String,
          ref: 'User',
          required: true,
        },
        count: {
          type: Number,
          default: 1,
        },
        receivedAt: {
          type: Date,
          default: Date.now,
        },
        isConverted: {
          type: Boolean,
          default: false,
        },
        convertedAt: {
          type: Date,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

export default Wallet;
